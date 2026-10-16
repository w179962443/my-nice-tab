import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { crc32 } from 'node:zlib';
import { prepareRelease } from '../scripts/prepare-release.mjs';

const commit = 'c'.repeat(40);

function makeZip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const filename = Buffer.from(name);
    const data = Buffer.from(text);
    const checksum = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    locals.push(header, filename, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += header.length + filename.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const validZip = makeZip({
  'manifest.json': '{"manifest_version":3}',
  'release.json': '{"build":2}',
});

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'nicetab-release-'));
  const releaseFile = join(root, 'public', 'release.json');
  const buildDir = join(root, 'build');
  const zipDir = join(root, 'zip');
  const outputDir = join(root, 'out');
  try {
    await Promise.all([mkdir(join(root, 'public')), mkdir(buildDir), mkdir(zipDir)]);
    await writeFile(releaseFile, '{"build":2}');
    await writeFile(join(buildDir, 'release.json'), '{"build":2}');
    await writeFile(join(buildDir, 'manifest.json'), '{"manifest_version":3}');
    await writeFile(join(zipDir, 'extension.zip'), validZip);
    await run({ releaseFile, buildDir, zipDir, outputDir, commit });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('copies the only ZIP and emits matching static metadata', async () => {
  await fixture(async input => {
    const { archivePath, manifestPath } = await prepareRelease(input);
    assert.equal(archivePath, join(input.outputDir, `nice-tab-2-${commit}.zip`));
    assert.equal(manifestPath, join(input.outputDir, 'latest.json'));
    assert.deepEqual(await readdir(input.outputDir), [
      'latest.json',
      `nice-tab-2-${commit}.zip`,
    ]);
    assert.deepEqual(await readFile(archivePath), validZip);
    assert.deepEqual(JSON.parse(await readFile(manifestPath, 'utf8')), {
      schema: 1,
      build: 2,
      archive: `nice-tab-2-${commit}.zip`,
      sha256: createHash('sha256').update(validZip).digest('hex'),
      commit,
    });
  });
});

test('rejects corrupt, nested, stale, or Firefox ZIPs before writing metadata', async () => {
  const invalid = [
    Buffer.from('not a zip'),
    makeZip({
      'folder/manifest.json': '{"manifest_version":3}',
      'folder/release.json': '{"build":2}',
    }),
    makeZip({ 'manifest.json': '{"manifest_version":3}', 'release.json': '{"build":3}' }),
    makeZip({ 'manifest.json': '{"manifest_version":2}', 'release.json': '{"build":2}' }),
  ];
  for (const archive of invalid) {
    await fixture(async input => {
      await writeFile(join(input.zipDir, 'extension.zip'), archive);
      await assert.rejects(prepareRelease(input));
      await assert.rejects(readFile(join(input.outputDir, 'latest.json')));
    });
  }
});

test('rejects missing, inconsistent, or ambiguous build input', async () => {
  await fixture(async input => {
    await writeFile(input.releaseFile, '{"build":0}');
    await assert.rejects(prepareRelease(input));
  });
  await fixture(async input => {
    await writeFile(join(input.buildDir, 'release.json'), '{"build":3}');
    await assert.rejects(prepareRelease(input));
  });
  await fixture(async input => {
    await rm(join(input.buildDir, 'manifest.json'));
    await assert.rejects(prepareRelease(input));
  });
  await fixture(async input => {
    await writeFile(join(input.zipDir, 'other.zip'), 'second');
    await assert.rejects(prepareRelease(input));
  });
  await fixture(async input => {
    await rm(join(input.zipDir, 'extension.zip'));
    await assert.rejects(prepareRelease(input));
  });
});
