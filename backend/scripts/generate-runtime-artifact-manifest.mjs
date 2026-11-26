import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeRuntimeArtifactManifest } from './support/runtime-artifact-manifest.mjs';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = resolve(backendDir, '..');
const result = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: repoDir,
  encoding: 'utf8',
  windowsHide: true,
});
const gitCommit =
  result.status === 0
    ? String(result.stdout ?? '').trim().toLowerCase()
    : readGitHeadWithoutSubprocess(repoDir);
const status = spawnSync(
  'git',
  ['status', '--porcelain', '--untracked-files=all'],
  { cwd: repoDir, encoding: 'utf8', windowsHide: true },
);
// A constrained builder may forbid child-process creation. In that case the
// artifact remains buildable for local verification, but is deliberately
// marked dirty so the formal activation runner rejects it fail-closed.
const sourceTreeClean = status.status === 0 && String(status.stdout ?? '').trim().length === 0;
const inspected = writeRuntimeArtifactManifest({
  distDir: resolve(backendDir, 'dist'),
  gitCommit,
  sourceTreeClean,
});
process.stdout.write(
  `${JSON.stringify({
    status: 'runtime_artifact_manifest_created',
    gitCommit: inspected.gitCommit,
    sourceTreeClean: inspected.sourceTreeClean,
    manifestSha256: inspected.manifestSha256,
    treeSha256: inspected.treeSha256,
    entrypointSha256: inspected.entrypointSha256,
    fileCount: inspected.fileCount,
  })}\n`,
);

function readGitHeadWithoutSubprocess(repositoryDir) {
  const dotGit = resolve(repositoryDir, '.git');
  const gitDir = statSync(dotGit).isDirectory()
    ? dotGit
    : resolve(repositoryDir, readFileSync(dotGit, 'utf8').trim().replace(/^gitdir:\s*/i, ''));
  const head = readFileSync(resolve(gitDir, 'HEAD'), 'utf8').trim();
  if (/^[0-9a-f]{40}$/i.test(head)) return head.toLowerCase();
  const match = /^ref:\s+(.+)$/.exec(head);
  if (!match) throw new Error('runtime_artifact_git_head_unavailable');
  const ref = match[1];
  const commonDirFile = resolve(gitDir, 'commondir');
  const commonDir = existsSync(commonDirFile)
    ? resolve(gitDir, readFileSync(commonDirFile, 'utf8').trim())
    : gitDir;
  for (const root of [gitDir, commonDir]) {
    const looseRef = resolve(root, ref);
    if (existsSync(looseRef)) {
      const commit = readFileSync(looseRef, 'utf8').trim().toLowerCase();
      if (/^[0-9a-f]{40}$/.test(commit)) return commit;
    }
    const packedRefs = resolve(root, 'packed-refs');
    if (!existsSync(packedRefs)) continue;
    for (const line of readFileSync(packedRefs, 'utf8').split(/\r?\n/)) {
      const packed = /^([0-9a-f]{40})\s+(.+)$/.exec(line);
      if (packed?.[2] === ref) return packed[1].toLowerCase();
    }
  }
  throw new Error('runtime_artifact_git_head_unavailable');
}
