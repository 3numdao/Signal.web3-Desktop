import got from 'got';

import packageJson from '../../package.json';

import * as durations from './durations';
import { getUserAgent } from './getUserAgent';

const GOT_CONNECT_TIMEOUT = durations.MINUTE;
const GOT_LOOKUP_TIMEOUT = durations.MINUTE;
const GOT_SOCKET_TIMEOUT = durations.MINUTE;
const GOT_RETRY_LIMIT = 1;

export const commonGot = got.extend({
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
    statusCodes: [429, 503],
  },
});
