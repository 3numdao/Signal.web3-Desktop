/* eslint-disable import/no-extraneous-dependencies */
const process = require('node:process');
const fs = require('node:fs');
const path = require('node:path');

const { platform } = require('node:os');
const { createHash } = require('node:crypto');
const { execSync } = require('node:child_process');

const arg = require('arg');
const AWS = require('aws-sdk');
const yaml = require('js-yaml');
const mime = require('mime');

const retryDelay = 30; // seconds

async function main() {
  const args = arg({
    '--help': Boolean,
    '--dry': Boolean,
    '--skip': Boolean,
    '--fake': String,
    '--arch': String,
  });

  if (args._.length < 1 || args['--help']) {
    err(
      1,
      'usage: upload.js [--dry] [--skip] [--fake <version>] [--arch <arch>] <s3_bucket>'
    );
  }

  const bucketName = args._[0];

  const gitTopLevel = execSync('git rev-parse --show-toplevel')
    .toString()
    .trim();

  const releaseDir = path.join(gitTopLevel, 'release');

  // eslint-disable-next-line global-require, import/no-dynamic-require
  const { version } = require(path.join(gitTopLevel, 'package.json'));

  const release = version.includes('beta') ? 'beta' : 'latest';

  let releaseFileBase;
  let releaseFileExts;
  let primaryExp;

  switch (platform()) {
    case 'darwin':
      releaseFileBase = `${release}-mac.yml`;
      releaseFileExts = ['.dmg', '.zip'];
      primaryExp = /-x64-.*.zip$/;
      break;
    case 'linux':
      releaseFileBase = `${release}-linux.yml`;
      releaseFileExts = ['.deb'];
      primaryExp = /_amd64.deb$/;
      break;
    case 'win32':
      releaseFileBase = `${release}.yml`;
      releaseFileExts = ['.exe'];
      primaryExp = /.exe$/;
      break;
    default:
      err(2, 'unsupported platform:', platform());
      return;
  }

  const fakeVersion = args['--fake'];
  const manifest = {
    version: fakeVersion || version,
    files: [],
    path: '',
    sha512: '',
    releaseDate: new Date(),
  };

  const uploads = [];
  const bases = await fs.promises.readdir(releaseDir);
  for (let base of bases) {
    if (args['--arch'] && !base.includes(args['--arch'])) continue;
    if (!base.includes(version)) continue;

    const releaseFile = path.join(releaseDir, base);
    if (!args['--skip']) uploads.push(releaseFile);

    const ext = path.extname(base);
    if (!releaseFileExts.includes(ext)) continue;

    const stat = fs.statSync(releaseFile);

    // eslint-disable-next-line no-await-in-loop
    const sha512 = await getSHA512(releaseFile);

    if (fakeVersion) {
      base = base.replace(version, fakeVersion);
    }

    const file = {
      url: base,
      sha512,
      size: stat.size,
    };

    // @ts-ignore
    manifest.files.push(file);

    if (base.match(primaryExp)) {
      manifest.path = base;
      manifest.sha512 = sha512;
    }
  }

  if (manifest.files.length < 1) err(3, 'no files found for', version);
  if (!manifest.path) err(4, 'no primary path found');

  const releaseFile = path.join(releaseDir, releaseFileBase);
  fs.writeFileSync(releaseFile, yaml.dump(manifest, { lineWidth: -1 }));
  uploads.push(releaseFile);

  const s3 = new AWS.S3({
    endpoint:
      'https://de4b9bc87b7091e05993555f58443f2f.r2.cloudflarestorage.com',
  });

  for (const filePath of uploads) {
    let key = `desktop/${path.basename(filePath)}`;
    if (fakeVersion) {
      key = key.replace(version, fakeVersion);
    }

    if (args['--dry']) {
      out('DRY upload:', filePath, '\n         =>', bucketName, key);
    } else {
      // eslint-disable-next-line no-await-in-loop
      await upload(filePath, s3, bucketName, key);
    }
  }
}

/**
 * @param {fs.PathLike} filePath
 */
function getSHA512(filePath) {
  return new Promise(resolve => {
    const hash = createHash('sha512');
    fs.createReadStream(filePath)
      .on('data', data => hash.update(data))
      .on('end', () => resolve(hash.digest('base64')));
  });
}

/**
 * @param {string} filePath
 * @param {AWS.S3} s3
 * @param {string} bucket
 * @param {string} key
 */
async function upload(filePath, s3, bucket, key, attempts = 1) {
  out('upload:', filePath);
  try {
    const resp = await s3
      .upload({
        Bucket: bucket,
        Key: key,
        Body: fs.createReadStream(filePath),
        ContentType: contentTypeOf(filePath),
      })
      .promise();
    out('     =>', resp.Key, resp.ETag);
  } catch (e) {
    // @ts-ignore
    if (attempts < 3 && e.retryable) {
      // this happens in matrix builds uploading for all 3 platforms concurrently
      const sleepTime = retryDelay * attempts;
      err(-1, `upload ${key} failed (retrying in ${sleepTime} seconds):`, e);
      await new Promise(r => setTimeout(r, sleepTime * 1000));
      await upload(filePath, s3, bucket, key, attempts + 1);
    } else {
      throw e;
    }
  }
}

/**
 * @param {string} filePath
 */
function contentTypeOf(filePath) {
  // the mime helper provides the more generic octet-stream type for some
  // extensions, so we'll be explicit here (to emulate what Signal uses)
  switch (path.extname(filePath)) {
    case 'dmg':
      return 'application/x-apple-diskimage';
    case 'exe':
      return 'application/x-msdownload';
    default:
      return mime.getType(filePath) || 'application/octet-stream';
  }
}

/**
 * @param {any[]} args
 */
function out(...args) {
  process.stdout.write(`${toStr(args)}\n`);
}

/**
 * @param {number} code
 * @param {any[]} args
 */
function err(code, ...args) {
  process.stderr.write(`${toStr(args)}\n`);
  if (code > -1) process.exit(code);
}

/**
 * @param {any[]} args
 */
function toStr(args) {
  const strs = [];
  for (const a of args) {
    if (typeof a === 'object') {
      strs.push(JSON.stringify(a, null, 2));
    } else {
      strs.push(a.toString());
    }
  }

  return strs.join(' ');
}

(async () => {
  await main();
})();
