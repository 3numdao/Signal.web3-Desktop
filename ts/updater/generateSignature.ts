// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */
import { join, resolve } from 'path';

import {
  readdir as readdirCallback,
  readFileSync,
  existsSync,
  writeFileSync,
} from 'fs';

import pify from 'pify';

import * as Errors from '../types/errors';
import { getCliOptions } from './common';
import { hexToBinary, verifySignature, writeSignature } from './signature';
import * as packageJson from '../../package.json';

const readdir = pify(readdirCallback);

const OPTIONS = [
  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.',
  },
  {
    names: ['private', 'p'],
    type: 'string',
    help: 'Path to private key file (default: ./private.key)',
    default: 'private.key',
  },
  {
    names: ['update', 'u'],
    type: 'string',
    help: 'Path to the update package (default: the .exe or .zip in ./release)',
  },
  {
    names: ['verify'],
    type: 'string',
    help: 'Verify the signature  for file (usage: <filename>:<version>:<publickey>)',
  },
  {
    names: ['version', 'v'],
    type: 'string',
    help: `Version number of this package (default: ${packageJson.version})`,
    default: packageJson.version,
  },
];

type OptionsType = {
  private: string;
  update: string;
  verify: string;
  version: string;
};

const cliOptions = getCliOptions<OptionsType>(OPTIONS);
go(cliOptions).catch(error => {
  console.error('Something went wrong!', Errors.toLogFormat(error));
});

async function go(options: OptionsType) {
  const { private: privateKeyPath, version } = options;

  if (options.verify) {
    const [fn, v, k] = options.verify.split(':', 3);

    const pub = hexToBinary(k);
    const sigStr = readFileSync(`${fn}.sig`);
    const sig = hexToBinary(sigStr.toString());

    const verified = await verifySignature(fn, v, sig, pub);
    if (verified) {
      console.log('Verification succeeded');
      return;
    }

    throw new Error('Verification failed');
  }

  if (!existsSync(privateKeyPath)) {
    const privateKeyEnv = process.env.UPDATES_PRIVATE_KEY;
    if (privateKeyEnv) writeFileSync(privateKeyPath, privateKeyEnv);
  }

  let updatePaths: Array<string>;
  if (options.update) {
    updatePaths = [options.update];
  } else {
    updatePaths = await findUpdatePaths();
  }

  await Promise.all(
    updatePaths.map(async updatePath => {
      console.log('Signing with...');
      console.log(`  version: ${version}`);
      console.log(`  update file: ${updatePath}`);
      console.log(`  private key file: ${privateKeyPath}`);

      await writeSignature(updatePath, version, privateKeyPath);
    })
  );
}

const IS_SIGNABLE = /\.(exe|zip|deb)$/;
async function findUpdatePaths(): Promise<Array<string>> {
  const releaseDir = resolve('release');
  const files: Array<string> = await readdir(releaseDir);

  const max = files.length;
  const results = new Array<string>();
  for (let i = 0; i < max; i += 1) {
    const file = files[i];
    const fullPath = join(releaseDir, file);

    if (IS_SIGNABLE.test(file)) {
      results.push(fullPath);
    }
  }

  if (results.length === 0) {
    throw new Error("No suitable file found in 'release' folder!");
  }

  return results;
}
