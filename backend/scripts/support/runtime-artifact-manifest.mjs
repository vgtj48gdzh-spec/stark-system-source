import { createHash } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

export const RUNTIME_ARTIFACT_MANIFEST_SCHEMA = 'stark_runtime_artifact_v1';
export const RUNTIME_ARTIFACT_MANIFEST_FILE = 'runtime-artifact-manifest.json';
export const RUNTIME_ARTIFACT_ENTRYPOINT = 'main.js';

export function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function collectRuntimeArtifactFiles(distDir) {
  const root = resolve(distDir);
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      const info = lstatSync(absolute);
      if (info.isSymbolicLink()) throw new Error('runtime_artifact_symlink_forbidden');
      if (info.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!info.isFile()) throw new Error('runtime_artifact_non_regular_entry_forbidden');
      const path = normalizeRelativePath(relative(root, absolute));
      if (path === RUNTIME_ARTIFACT_MANIFEST_FILE) continue;
      const buffer = readFileSync(absolute);
      files.push({ path, size: buffer.length, sha256: sha256Buffer(buffer) });
    }
  };
  visit(root);
  files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
  return files;
}

export function buildRuntimeArtifactManifest({
  distDir,
  gitCommit,
  sourceTreeClean,
  entrypoint = RUNTIME_ARTIFACT_ENTRYPOINT,
}) {
  const commit = String(gitCommit ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('runtime_artifact_git_commit_invalid');
  const normalizedEntrypoint = normalizeRelativePath(entrypoint);
  if (normalizedEntrypoint !== RUNTIME_ARTIFACT_ENTRYPOINT) {
    throw new Error('runtime_artifact_entrypoint_not_exact');
  }
  const files = collectRuntimeArtifactFiles(distDir);
  const entry = files.find((candidate) => candidate.path === normalizedEntrypoint);
  if (!entry) throw new Error('runtime_artifact_entrypoint_missing');
  return {
    schemaVersion: RUNTIME_ARTIFACT_MANIFEST_SCHEMA,
    gitCommit: commit,
    sourceTreeClean: sourceTreeClean === true,
    entrypoint: normalizedEntrypoint,
    entrypointSha256: entry.sha256,
    fileCount: files.length,
    treeSha256: runtimeArtifactTreeSha256(files),
    files,
  };
}

export function serializeRuntimeArtifactManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function writeRuntimeArtifactManifest({ distDir, gitCommit, sourceTreeClean }) {
  const root = resolve(distDir);
  const manifest = buildRuntimeArtifactManifest({ distDir: root, gitCommit, sourceTreeClean });
  const buffer = Buffer.from(serializeRuntimeArtifactManifest(manifest), 'utf8');
  const target = resolve(root, RUNTIME_ARTIFACT_MANIFEST_FILE);
  const temporary = resolve(root, `.${RUNTIME_ARTIFACT_MANIFEST_FILE}.${process.pid}.tmp`);
  let descriptor = null;
  try {
    descriptor = openSync(temporary, 'wx', 0o644);
    writeFileSync(descriptor, buffer);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    renameSync(temporary, target);
    syncDirectoryBestEffort(dirname(target));
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    try {
      unlinkSync(temporary);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return inspectRuntimeArtifactManifest({
    manifestPath: target,
    expectedGitCommit: gitCommit,
    requireSourceTreeClean: false,
  });
}

export function inspectRuntimeArtifactManifest({
  manifestPath,
  expectedGitCommit,
  expectedManifestSha256,
  requireSourceTreeClean = true,
}) {
  const target = resolve(manifestPath);
  const info = lstatSync(target);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error('runtime_artifact_manifest_not_regular_file');
  }
  const buffer = readFileSync(target);
  const manifestSha256 = sha256Buffer(buffer);
  if (
    expectedManifestSha256 &&
    manifestSha256 !== requiredSha256(expectedManifestSha256, 'runtime_artifact_manifest_sha_invalid')
  ) {
    throw new Error('runtime_artifact_manifest_sha_mismatch');
  }
  let manifest;
  try {
    manifest = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new Error('runtime_artifact_manifest_json_invalid');
  }
  assertExactManifestShape(manifest);
  const expectedCommit = String(expectedGitCommit ?? manifest.gitCommit).trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(expectedCommit) || manifest.gitCommit !== expectedCommit) {
    throw new Error('runtime_artifact_manifest_commit_mismatch');
  }
  if (requireSourceTreeClean && manifest.sourceTreeClean !== true) {
    throw new Error('runtime_artifact_source_tree_not_clean_at_build');
  }
  const distDir = dirname(target);
  const actualFiles = collectRuntimeArtifactFiles(distDir);
  if (JSON.stringify(actualFiles) !== JSON.stringify(manifest.files)) {
    throw new Error('runtime_artifact_file_manifest_mismatch');
  }
  const treeSha256 = runtimeArtifactTreeSha256(actualFiles);
  if (treeSha256 !== manifest.treeSha256) throw new Error('runtime_artifact_tree_sha_mismatch');
  const entry = actualFiles.find((candidate) => candidate.path === manifest.entrypoint);
  if (!entry || entry.sha256 !== manifest.entrypointSha256) {
    throw new Error('runtime_artifact_entrypoint_sha_mismatch');
  }
  return {
    schemaVersion: manifest.schemaVersion,
    gitCommit: manifest.gitCommit,
    sourceTreeClean: manifest.sourceTreeClean,
    manifestPath: target,
    manifestSha256,
    distDir,
    entrypoint: manifest.entrypoint,
    entrypointPath: resolve(distDir, manifest.entrypoint),
    entrypointSha256: manifest.entrypointSha256,
    treeSha256,
    fileCount: manifest.fileCount,
  };
}

function assertExactManifestShape(manifest) {
  const keys = Object.keys(manifest ?? {}).sort();
  const expectedKeys = [
    'entrypoint',
    'entrypointSha256',
    'fileCount',
    'files',
    'gitCommit',
    'schemaVersion',
    'sourceTreeClean',
    'treeSha256',
  ].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    throw new Error('runtime_artifact_manifest_shape_invalid');
  }
  if (manifest.schemaVersion !== RUNTIME_ARTIFACT_MANIFEST_SCHEMA) {
    throw new Error('runtime_artifact_manifest_schema_invalid');
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.gitCommit ?? '')) {
    throw new Error('runtime_artifact_manifest_commit_invalid');
  }
  if (typeof manifest.sourceTreeClean !== 'boolean') {
    throw new Error('runtime_artifact_manifest_source_tree_state_invalid');
  }
  if (manifest.entrypoint !== RUNTIME_ARTIFACT_ENTRYPOINT) {
    throw new Error('runtime_artifact_manifest_entrypoint_invalid');
  }
  requiredSha256(manifest.entrypointSha256, 'runtime_artifact_entrypoint_sha_invalid');
  requiredSha256(manifest.treeSha256, 'runtime_artifact_tree_sha_invalid');
  if (!Array.isArray(manifest.files) || manifest.fileCount !== manifest.files.length) {
    throw new Error('runtime_artifact_manifest_file_count_invalid');
  }
  const normalized = manifest.files.map((entry) => ({
    path: normalizeRelativePath(entry?.path),
    size: Number(entry?.size),
    sha256: requiredSha256(entry?.sha256, 'runtime_artifact_file_sha_invalid'),
  }));
  if (
    normalized.some((entry) => !Number.isSafeInteger(entry.size) || entry.size < 0) ||
    JSON.stringify(normalized) !== JSON.stringify(manifest.files) ||
    new Set(normalized.map((entry) => entry.path)).size !== normalized.length
  ) {
    throw new Error('runtime_artifact_manifest_files_invalid');
  }
  const sorted = [...normalized].sort((left, right) => left.path.localeCompare(right.path, 'en'));
  if (JSON.stringify(sorted) !== JSON.stringify(normalized)) {
    throw new Error('runtime_artifact_manifest_files_not_sorted');
  }
}

function runtimeArtifactTreeSha256(files) {
  const canonical = files.map((entry) => `${entry.path}\0${entry.size}\0${entry.sha256}`).join('\n');
  return sha256Buffer(`${canonical}\n`);
}

function normalizeRelativePath(value) {
  const normalized = String(value ?? '').split(sep).join('/').replaceAll('\\', '/');
  if (
    normalized.length === 0 ||
    normalized.startsWith('/') ||
    normalized.includes('..') ||
    normalized.includes('\0') ||
    normalized.includes('\n') ||
    normalized.includes('\r')
  ) {
    throw new Error('runtime_artifact_relative_path_invalid');
  }
  return normalized;
}

function requiredSha256(value, reason) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error(reason);
  return normalized;
}

function syncDirectoryBestEffort(path) {
  let descriptor = null;
  try {
    descriptor = openSync(path, 'r');
    fsyncSync(descriptor);
  } catch (error) {
    if (process.platform !== 'win32') throw error;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}
