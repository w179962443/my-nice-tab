import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { crc32, inflateRawSync } from 'node:zlib';

function validBuild(value) {
  return (
    value &&
    typeof value === 'object' &&
    Number.isSafeInteger(value.build) &&
    value.build > 0
  );
}

function readZipRootFiles(data) {
  let end = -1;
  for (let pos = data.length - 22; pos >= Math.max(0, data.length - 65557); pos--) {
    if (
      data.readUInt32LE(pos) === 0x06054b50 &&
      pos + 22 + data.readUInt16LE(pos + 20) === data.length
    ) {
      end = pos;
      break;
    }
  }
  if (end < 0) throw new Error('Invalid ZIP end record');

  const count = data.readUInt16LE(end + 10);
  const directorySize = data.readUInt32LE(end + 12);
  const directoryOffset = data.readUInt32LE(end + 16);
  if (directoryOffset + directorySize !== end) throw new Error('Invalid ZIP directory');
  const files = new Map();
  let pos = directoryOffset;
  for (let index = 0; index < count; index++) {
    if (pos + 46 > end || data.readUInt32LE(pos) !== 0x02014b50) {
      throw new Error('Invalid ZIP entry');
    }
    const method = data.readUInt16LE(pos + 10);
    const checksum = data.readUInt32LE(pos + 16);
    const compressedSize = data.readUInt32LE(pos + 20);
    const size = data.readUInt32LE(pos + 24);
    const nameLength = data.readUInt16LE(pos + 28);
    const extraLength = data.readUInt16LE(pos + 30);
    const commentLength = data.readUInt16LE(pos + 32);
    const localOffset = data.readUInt32LE(pos + 42);
    const next = pos + 46 + nameLength + extraLength + commentLength;
    if (next > end) throw new Error('Invalid ZIP entry length');
    const name = data.toString('utf8', pos + 46, pos + 46 + nameLength);
    if (name === 'manifest.json' || name === 'release.json') {
      if (
        files.has(name) ||
        localOffset + 30 > directoryOffset ||
        data.readUInt32LE(localOffset) !== 0x04034b50
      ) {
        throw new Error(`Invalid or duplicate ZIP root file: ${name}`);
      }
      const start =
        localOffset +
        30 +
        data.readUInt16LE(localOffset + 26) +
        data.readUInt16LE(localOffset + 28);
      if (start + compressedSize > directoryOffset)
        throw new Error(`Truncated ZIP root file: ${name}`);
      const compressed = data.subarray(start, start + compressedSize);
      const content =
        method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
      if (!content || content.length !== size || crc32(content) !== checksum) {
        throw new Error(`Invalid ZIP root file: ${name}`);
      }
      files.set(name, content.toString('utf8'));
    }
    pos = next;
  }
  if (pos !== end || !files.has('manifest.json') || !files.has('release.json')) {
    throw new Error('ZIP root is missing manifest.json or release.json');
  }
  return files;
}

export async function prepareRelease({
  releaseFile,
  buildDir,
  zipDir,
  outputDir,
  commit,
}) {
  if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/i.test(commit)) {
    throw new Error('Expected a 40-character Git commit SHA');
  }

  const source = JSON.parse(await readFile(releaseFile, 'utf8'));
  const bundled = JSON.parse(await readFile(join(buildDir, 'release.json'), 'utf8'));
  if (!validBuild(source) || !validBuild(bundled) || source.build !== bundled.build) {
    throw new Error(
      'Source and bundled release.json must have the same positive build number',
    );
  }
  const buildManifest = JSON.parse(
    await readFile(join(buildDir, 'manifest.json'), 'utf8'),
  );
  if (buildManifest?.manifest_version !== 3)
    throw new Error('Expected a Chromium MV3 build');

  const zipFiles = (await readdir(zipDir)).filter(name =>
    name.toLowerCase().endsWith('.zip'),
  );
  if (zipFiles.length !== 1)
    throw new Error(`Expected exactly one WXT ZIP, found ${zipFiles.length}`);
  const zipPath = join(zipDir, zipFiles[0]);
  if (!(await stat(zipPath)).isFile()) throw new Error('WXT ZIP is not a file');
  const zipFilesAtRoot = readZipRootFiles(await readFile(zipPath));
  const zipManifest = JSON.parse(zipFilesAtRoot.get('manifest.json'));
  const zipRelease = JSON.parse(zipFilesAtRoot.get('release.json'));
  if (
    !isDeepStrictEqual(zipManifest, buildManifest) ||
    !validBuild(zipRelease) ||
    zipRelease.build !== source.build
  ) {
    throw new Error('ZIP manifest or personal build does not match the Chromium build');
  }

  await mkdir(outputDir, { recursive: true });
  const archive = `nice-tab-${source.build}-${commit.toLowerCase()}.zip`;
  const archivePath = join(outputDir, archive);
  await copyFile(zipPath, archivePath);
  const sha256 = createHash('sha256')
    .update(await readFile(archivePath))
    .digest('hex');
  const manifestPath = join(outputDir, 'latest.json');
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        schema: 1,
        build: source.build,
        archive,
        sha256,
        commit: commit.toLowerCase(),
      },
      null,
      2,
    ) + '\n',
  );
  return { archivePath, manifestPath };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [releaseFile, buildDir, zipDir, outputDir, commit] = process.argv.slice(2);
  if ([releaseFile, buildDir, zipDir, outputDir, commit].some(value => !value)) {
    console.error(
      'Usage: node scripts/prepare-release.mjs RELEASE_FILE BUILD_DIR ZIP_DIR OUTPUT_DIR COMMIT',
    );
    process.exitCode = 2;
  } else {
    prepareRelease({ releaseFile, buildDir, zipDir, outputDir, commit })
      .then(result => console.log(JSON.stringify(result)))
      .catch(error => {
        console.error(error);
        process.exitCode = 1;
      });
  }
}
