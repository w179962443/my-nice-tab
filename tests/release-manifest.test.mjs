import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLocalRelease,
  resolveAvailableRelease,
} from '../entrypoints/common/release/manifest.ts';

const commit = 'a'.repeat(40);
const remote = {
  schema: 1,
  build: 2,
  archive: `nice-tab-2-${commit}.zip`,
  sha256: 'b'.repeat(64),
  commit,
};
const manifestUrl = 'https://downloads.example.test/releases/latest.json';

test('local build is a positive safe integer', () => {
  assert.deepEqual(parseLocalRelease({ build: 1 }), { build: 1 });
  for (const build of [0, -1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(parseLocalRelease({ build }), null);
  }
  assert.equal(parseLocalRelease(null), null);
});

test('only a higher build returns a same-origin HTTPS archive', () => {
  assert.deepEqual(resolveAvailableRelease({ build: 1 }, remote, manifestUrl), {
    build: 2,
    downloadUrl: `https://downloads.example.test/releases/${remote.archive}`,
    sha256: remote.sha256,
  });
  assert.equal(resolveAvailableRelease({ build: 2 }, remote, manifestUrl), null);
  assert.equal(resolveAvailableRelease({ build: 3 }, remote, manifestUrl), null);
});

test('rejects malformed remote manifest and unsafe download names', () => {
  const invalid = [
    { build: 0 },
    { build: '2' },
    { schema: 2 },
    { commit: 'bad' },
    { sha256: 'bad' },
    { archive: '../nice-tab-2-' + commit + '.zip' },
    { archive: 'https://evil.test/nice-tab-2-' + commit + '.zip' },
    { archive: 'nice-tab-1-' + commit + '.zip' },
    { archive: 'nice-tab-2-' + 'c'.repeat(40) + '.zip' },
  ];
  for (const alteration of invalid) {
    assert.equal(
      resolveAvailableRelease({ build: 1 }, { ...remote, ...alteration }, manifestUrl),
      null,
    );
  }
  assert.equal(
    resolveAvailableRelease(
      { build: 1 },
      remote,
      'http://downloads.example.test/latest.json',
    ),
    null,
  );
  assert.equal(
    resolveAvailableRelease(
      { build: 1 },
      remote,
      'https://user:pass@downloads.example.test/latest.json',
    ),
    null,
  );
});
