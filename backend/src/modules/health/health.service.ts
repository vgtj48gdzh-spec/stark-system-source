import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'fs';
import { join, relative, resolve, sep } from 'path';
import { FinanceSafetyService } from '../finance-safety/finance-safety.service';

interface PackageInfo {
  name?: string;
  version?: string;
}

interface RuntimeBuildInfo {
  appVersion: string | null;
  buildId: string | null;
  gitCommit: string | null;
  artifactManifestSha256: string | null;
  artifactSourceTreeClean: boolean | null;
  artifactTreeSha256: string | null;
  artifactEntrypoint: string | null;
  artifactEntrypointSha256: string | null;
  artifactFileCount: number | null;
}

interface RuntimeArtifactFile {
  path: string;
  size: number;
  sha256: string;
}

interface RuntimeArtifactManifest {
  schemaVersion: string;
  gitCommit: string;
  sourceTreeClean: boolean;
  entrypoint: string;
  entrypointSha256: string;
  fileCount: number;
  treeSha256: string;
  files: RuntimeArtifactFile[];
}

@Injectable()
export class HealthService {
  private readonly startedAt = new Date();
  private readonly packageInfo = this.loadPackageInfo();
  private readonly runtimeBuildInfo = this.loadRuntimeBuildInfo();

  constructor(
    private readonly dataSource: DataSource,
    private readonly financeSafetyService: FinanceSafetyService,
  ) {}

  async getHealth() {
    const now = new Date();
    const promotionWindow = this.financeSafetyService.getBankSmsPromotionWindow();
    let databaseStatus = 'down';
    let databaseError: string | null = null;

    try {
      await this.dataSource.query('SELECT 1 AS ok');
      databaseStatus = 'up';
    } catch (error) {
      databaseError = error instanceof Error ? error.message : 'Unknown database error';
    }

    return {
      app: {
        status: databaseStatus === 'up' ? 'up' : 'degraded',
        name: this.packageInfo.name ?? 'stark-system-backend',
        appVersion: this.runtimeBuildInfo.appVersion,
        startedAt: this.startedAt.toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        pid: process.pid,
      },
      database: {
        status: databaseStatus,
        error: databaseError,
      },
      time: {
        currentTime: now.toISOString(),
      },
      build: {
        version: this.runtimeBuildInfo.appVersion,
        appVersion: this.runtimeBuildInfo.appVersion,
        buildId: this.runtimeBuildInfo.buildId,
        gitCommit: this.runtimeBuildInfo.gitCommit,
        artifact: {
          manifestSha256: this.runtimeBuildInfo.artifactManifestSha256,
          sourceTreeClean: this.runtimeBuildInfo.artifactSourceTreeClean,
          treeSha256: this.runtimeBuildInfo.artifactTreeSha256,
          entrypoint: this.runtimeBuildInfo.artifactEntrypoint,
          entrypointSha256: this.runtimeBuildInfo.artifactEntrypointSha256,
          fileCount: this.runtimeBuildInfo.artifactFileCount,
        },
        nodeVersion: process.version,
        environment: process.env.NODE_ENV ?? 'development',
      },
      financeSafety: {
        bankSmsPromotion: {
          enabled: promotionWindow.enabled,
          policyVersion: promotionWindow.policyVersion,
          enabledAt: promotionWindow.enabledAt?.toISOString() ?? null,
          minRawSmsIdExclusive: promotionWindow.minRawSmsIdExclusive,
          allowedGenerationSha256: promotionWindow.allowedGeneration
            ? createHash('sha256').update(promotionWindow.allowedGeneration).digest('hex')
            : null,
        },
        protectedWrites: {
          financeFundFlow: this.financeSafetyService.isEnabled(
            'FINANCE_FUND_FLOW_WRITE_ENABLED',
          ),
          virtualAccountMutation: this.financeSafetyService.isEnabled(
            'VIRTUAL_ACCOUNT_MUTATION_ENABLED',
          ),
          autoReconciliation: this.financeSafetyService.isEnabled(
            'AUTO_RECONCILIATION_ENABLED',
          ),
        },
      },
    };
  }

  private loadPackageInfo(): PackageInfo {
    const candidates = [
      join(process.cwd(), 'package.json'),
      join(__dirname, '..', '..', '..', '..', 'package.json'),
    ];

    for (const filePath of candidates) {
      if (!existsSync(filePath)) {
        continue;
      }

      try {
        return JSON.parse(readFileSync(filePath, 'utf8')) as PackageInfo;
      } catch {
        continue;
      }
    }

    return {};
  }

  private loadRuntimeBuildInfo(): RuntimeBuildInfo {
    const appVersion = this.packageInfo.version ?? null;
    const artifact = this.loadRuntimeArtifactManifest();
    const gitCommit = artifact?.gitCommit ?? null;
    const runtimeStamp = this.startedAt.toISOString().replace(/\D/g, '').slice(0, 14);
    const buildId =
      process.env.APP_BUILD_ID?.trim() ||
      (appVersion && gitCommit
        ? `${appVersion}-${gitCommit}`
        : appVersion
          ? `${appVersion}-${runtimeStamp}`
          : gitCommit ?? runtimeStamp);

    return {
      appVersion,
      buildId,
      gitCommit,
      artifactManifestSha256: artifact?.manifestSha256 ?? null,
      artifactSourceTreeClean: artifact?.sourceTreeClean ?? null,
      artifactTreeSha256: artifact?.treeSha256 ?? null,
      artifactEntrypoint: artifact?.entrypoint ?? null,
      artifactEntrypointSha256: artifact?.entrypointSha256 ?? null,
      artifactFileCount: artifact?.fileCount ?? null,
    };
  }

  private loadRuntimeArtifactManifest():
    | (RuntimeArtifactManifest & { manifestSha256: string })
    | null {
    const distDir = resolve(process.cwd(), 'dist');
    const manifestPath = resolve(distDir, 'runtime-artifact-manifest.json');
    if (!existsSync(manifestPath)) return null;
    try {
      const info = lstatSync(manifestPath);
      if (!info.isFile() || info.isSymbolicLink()) return null;
      const buffer = readFileSync(manifestPath);
      const manifest = JSON.parse(buffer.toString('utf8')) as RuntimeArtifactManifest;
      if (
        manifest.schemaVersion !== 'stark_runtime_artifact_v1' ||
        !/^[0-9a-f]{40}$/.test(manifest.gitCommit ?? '') ||
        manifest.sourceTreeClean !== true ||
        manifest.entrypoint !== 'main.js' ||
        !this.isSha256(manifest.entrypointSha256) ||
        !this.isSha256(manifest.treeSha256) ||
        !Array.isArray(manifest.files) ||
        manifest.fileCount !== manifest.files.length
      ) {
        return null;
      }
      const actualFiles = this.collectRuntimeArtifactFiles(distDir);
      if (JSON.stringify(actualFiles) !== JSON.stringify(manifest.files)) return null;
      const treeSha256 = this.runtimeArtifactTreeSha256(actualFiles);
      if (treeSha256 !== manifest.treeSha256) return null;
      const entrypoint = actualFiles.find((entry) => entry.path === manifest.entrypoint);
      if (!entrypoint || entrypoint.sha256 !== manifest.entrypointSha256) return null;
      return {
        ...manifest,
        manifestSha256: this.sha256(buffer),
      };
    } catch {
      return null;
    }
  }

  private collectRuntimeArtifactFiles(distDir: string): RuntimeArtifactFile[] {
    const files: RuntimeArtifactFile[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const absolute = resolve(directory, entry.name);
        const info = lstatSync(absolute);
        if (info.isSymbolicLink()) throw new Error('runtime_artifact_symlink_forbidden');
        if (info.isDirectory()) {
          visit(absolute);
          continue;
        }
        if (!info.isFile()) throw new Error('runtime_artifact_non_regular_entry_forbidden');
        const path = relative(distDir, absolute).split(sep).join('/');
        if (path === 'runtime-artifact-manifest.json') continue;
        const content = readFileSync(absolute);
        files.push({ path, size: content.length, sha256: this.sha256(content) });
      }
    };
    visit(distDir);
    files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
    return files;
  }

  private runtimeArtifactTreeSha256(files: RuntimeArtifactFile[]): string {
    const canonical = files
      .map((entry) => `${entry.path}\0${entry.size}\0${entry.sha256}`)
      .join('\n');
    return this.sha256(`${canonical}\n`);
  }

  private sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private isSha256(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
  }
}
