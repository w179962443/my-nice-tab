import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPersonalRelease } from '../entrypoints/common/release/check.ts';

const commit = 'a'.repeat(40);
const manifestUrl = 'https://downloads.example.test/latest.json';
const localUrl = 'chrome-extension://local/release.json';
const remote = {
  schema: 1,
  build: 2,
  archive: `nice-tab-2-${commit}.zip`,
  sha256: 'b'.repeat(64),
  commit,
};
const response = (body, ok = true) => ({ ok, json: async () => body });

test('empty or insecure URL does not request anything', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    throw Error('unexpected fetch');
  };
  assert.equal(await checkPersonalRelease('', localUrl, fetcher), null);
  assert.equal(
    await checkPersonalRelease(
      'http://downloads.example.test/latest.json',
      localUrl,
      fetcher,
    ),
    null,
  );
  assert.equal(calls, 0);
});

test('valid responses disable cache and yield available release', async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push([url, options]);
    return response(url === localUrl ? { build: 1 } : remote);
  };
  const found = await checkPersonalRelease(manifestUrl, localUrl, fetcher);
  assert.deepEqual(found, {
    build: 2,
    downloadUrl: `https://downloads.example.test/${remote.archive}`,
    sha256: remote.sha256,
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[1][0], manifestUrl);
  assert.equal(requests[1][1].cache, 'no-store');
});

test('HTTP, network, malformed JSON and timeout failures are silent', async () => {
  const local = async url =>
    url === localUrl ? response({ build: 1 }) : response(remote, false);
  assert.equal(await checkPersonalRelease(manifestUrl, localUrl, local), null);
  const rejected = async url =>
    url === localUrl ? response({ build: 1 }) : Promise.reject(Error('offline'));
  assert.equal(await checkPersonalRelease(manifestUrl, localUrl, rejected), null);
  const malformed = async url =>
    url === localUrl
      ? response({ build: 1 })
      : {
          ok: true,
          json: async () => {
            throw Error('bad json');
          },
        };
  assert.equal(await checkPersonalRelease(manifestUrl, localUrl, malformed), null);
  const timeout = async (url, options) => {
    if (url === localUrl) return response({ build: 1 });
    return new Promise((_, reject) =>
      options.signal.addEventListener('abort', () => reject(Error('aborted'))),
    );
  };
  assert.equal(await checkPersonalRelease(manifestUrl, localUrl, timeout, 10), null);
});
