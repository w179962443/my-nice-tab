import { resolveAvailableRelease, type AvailableRelease } from './manifest.ts';

export async function checkPersonalRelease(
  manifestUrl: string,
  localReleaseUrl: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<AvailableRelease | null> {
  try {
    const url = new URL(manifestUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash)
      return null;
  } catch {
    return null;
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Release check timed out'));
    }, timeoutMs);
  });

  try {
    const localResponse = await Promise.race([
      fetcher(localReleaseUrl, { signal: controller.signal }),
      timeout,
    ]);
    if (!localResponse.ok) return null;
    const local = await Promise.race([localResponse.json(), timeout]);
    const remoteResponse = await Promise.race([
      fetcher(manifestUrl, { cache: 'no-store', signal: controller.signal }),
      timeout,
    ]);
    if (!remoteResponse.ok) return null;
    const remote = await Promise.race([remoteResponse.json(), timeout]);
    return resolveAvailableRelease(local, remote, manifestUrl);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
