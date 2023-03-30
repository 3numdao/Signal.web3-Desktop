// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StrictOptions as GotOptions } from 'got';
import config from 'config';
import ProxyAgent from 'proxy-agent';

import * as packageJson from '../../package.json';
import { getUserAgent } from '../util/getUserAgent';
import * as durations from '../util/durations';
import { lookupWithFallback } from '../util/dns';

export const GOT_CONNECT_TIMEOUT = durations.MINUTE;
export const GOT_LOOKUP_TIMEOUT = durations.MINUTE;
export const GOT_SOCKET_TIMEOUT = durations.MINUTE;
const GOT_RETRY_LIMIT = 3;

export function getProxyUrl(): string | undefined {
  return process.env.HTTPS_PROXY || process.env.https_proxy;
}

export function getCertificateAuthority(): string {
  return config.get('certificateAuthority');
}

export function getGotOptions(url: string): GotOptions {
  const proxyUrl = getProxyUrl();
  const agent = proxyUrl
    ? {
        http: new ProxyAgent(proxyUrl),
        https: new ProxyAgent(proxyUrl),
      }
    : undefined;

  const opts: GotOptions = {
    agent,
    lookup: lookupWithFallback as GotOptions['lookup'],
    headers: {
      'Cache-Control': 'no-cache',
      'User-Agent': getUserAgent(packageJson.version),
    },
    timeout: {
      connect: GOT_CONNECT_TIMEOUT,
      lookup: GOT_LOOKUP_TIMEOUT,

      // This timeout is reset whenever we get new data on the socket
      socket: GOT_SOCKET_TIMEOUT,
    },
    retry: {
      limit: GOT_RETRY_LIMIT,
      errorCodes: [
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'EPIPE',
        'ENOTFOUND',
        'ENETUNREACH',
        'EAI_AGAIN',
      ],
      methods: ['GET', 'HEAD'],
      statusCodes: [413, 429, 503],
    },
  };

  if (url.startsWith('http')) {
    const targetUrl = new URL(url);
    if (targetUrl.hostname.endsWith('.signal.org')) {
      opts.https = { certificateAuthority: getCertificateAuthority() };
    }
  }

  return opts;
}
