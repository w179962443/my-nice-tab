export type AvailableRelease = {
  build: number;
  downloadUrl: string;
  sha256: string;
};

export function parseLocalRelease(value: unknown): { build: number } | null {
  if (value === null || typeof value !== 'object' || !('build' in value)) return null;
  const { build } = value;
  return typeof build === 'number' && Number.isSafeInteger(build) && build > 0
    ? { build }
    : null;
}

export function resolveAvailableRelease(
  local: unknown,
  remote: unknown,
  manifestUrl: string,
): AvailableRelease | null {
  const localRelease = parseLocalRelease(local);
  const remoteRelease = parseLocalRelease(remote);
  if (!localRelease || !remoteRelease || remoteRelease.build <= localRelease.build)
    return null;
  if (remote === null || typeof remote !== 'object') return null;
  if (!('schema' in remote) || remote.schema !== 1) return null;
  if (
    !('commit' in remote) ||
    typeof remote.commit !== 'string' ||
    !/^[a-f0-9]{40}$/i.test(remote.commit)
  )
    return null;
  if (
    !('sha256' in remote) ||
    typeof remote.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(remote.sha256)
  )
    return null;
  if (!('archive' in remote) || typeof remote.archive !== 'string') return null;
  if (remote.archive !== `nice-tab-${remoteRelease.build}-${remote.commit}.zip`)
    return null;

  try {
    const manifest = new URL(manifestUrl);
    if (
      manifest.protocol !== 'https:' ||
      manifest.username ||
      manifest.password ||
      manifest.hash
    )
      return null;
    const download = new URL(remote.archive, manifest);
    if (download.protocol !== 'https:' || download.origin !== manifest.origin)
      return null;
    return {
      build: remoteRelease.build,
      downloadUrl: download.href,
      sha256: remote.sha256,
    };
  } catch {
    return null;
  }
}
