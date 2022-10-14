import * as log from '../logging/log';

import { commonGot as got } from './CommonGot';
import { parseNumber } from './libphonenumberUtil';
import * as durations from './durations';
import { report } from './telemetry';

export type TranslateResult = {
  name?: string;
  address?: string;
  phoneNumber?: string;
  error?: string;
};

type LookupResult = {
  name?: string;
  phone?: string;
  address?: string;
  message?: string;
};

const ETHER_CACHE_URL = 'https://ethercache.herokuapp.com';
const UPDATE_EXTENSIONS_INTERVAL = durations.HOUR;

let extensions = ['.eth'];

export function canTranslateNameToPhoneNumber(name: string): boolean {
  for (const ext of extensions) {
    if (name.endsWith(ext)) {
      // log.info('chainHelper.canTranslate:', name);
      return true;
    }
  }

  return false;
}

export async function translateNameToPhoneNumber(
  name: string
): Promise<TranslateResult> {
  const result: TranslateResult = { name };

  const lookupUrl = `${ETHER_CACHE_URL}/lookup`;
  const resp = await got.get(lookupUrl, {
    searchParams: { name },
    timeout: { request: 10 * durations.SECOND },
    throwHttpErrors: false,
  });

  const contentType = resp.headers['content-type'];
  const contentLen = Number(resp.headers['content-length'] || '');

  let lookupResult: LookupResult;
  if (contentLen > 0 && contentType?.startsWith('application/json')) {
    lookupResult = JSON.parse(resp.body);
    result.address = lookupResult.address;

    const statusClass = Math.round(resp.statusCode / 100);
    switch (statusClass) {
      case 2:
        result.phoneNumber = cleanPhoneNumber(lookupResult.phone);
        if (!result.phoneNumber) {
          result.error = 'no phone record found';
        }
        break;
      default:
        result.error =
          lookupResult?.message ||
          `unknown service failure (${resp.statusCode})`;
    }
  } else {
    lookupResult = {};
    result.error = `unknown failure from ${lookupUrl}: ${resp.statusCode} ${resp.statusMessage}`;
  }

  const logFn = result.error ? log.error : log.info;
  logFn('chainHelper.translate:', result);
  report('eth-lookup', {
    extension: extname(name),
    result: result.error ? 'failure' : 'success',
  });

  return result;
}

async function updateExtensions() {
  const extUrl = `${ETHER_CACHE_URL}/extensions`;
  const resp = await got.get(extUrl, {
    timeout: { request: 10 * durations.SECOND },
    throwHttpErrors: false,
  });

  const contentType = resp.headers['content-type'];
  const contentLen = Number(resp.headers['content-length'] || '');

  let errMsg = '';

  if (contentLen > 0 && contentType?.startsWith('application/json')) {
    const extResult = JSON.parse(resp.body);
    const statusClass = Math.round(resp.statusCode / 100);
    switch (statusClass) {
      case 2:
        if (extResult instanceof Array) {
          extensions = extResult;
          return;
        }

        errMsg = 'unknown type received';
        break;
      default:
        errMsg = 'failed to retrieve extensions';
    }
  } else {
    errMsg = 'unknown failure';
  }

  log.error(
    `chainHelper.updateExtensions: ${errMsg}:`,
    resp.statusCode,
    resp.body
  );
}

function cleanPhoneNumber(number: string | undefined): string | undefined {
  if (number) {
    const result = parseNumber(number, getRegionCode());
    if (result.isValidNumber) {
      // log.info('chainHelper.clean', number, '=>', result.e164);
      return result.e164;
    }

    log.error('chainHelper.clean:', result.error);
  }

  return undefined;
}

// FIXME: there's likely a better way to obtain the default region code
function getRegionCode(): string | undefined {
  return window.storage.get('regionCode');
}

function extname(name: string): string {
  return name.substring(name.lastIndexOf('.') + 1, name.length) || '';
}

// Give the app some time to load before updating our list of extensions.
setTimeout(async () => {
  await updateExtensions();
  setInterval(async () => {
    await updateExtensions();
  }, UPDATE_EXTENSIONS_INTERVAL);
}, 3 * durations.SECOND);
