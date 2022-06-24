import got from 'got';
import * as log from '../logging/log';
import { parseNumber } from './libphonenumberUtil';

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

export function canTranslateNameToPhoneNumber(name: string): boolean {
  if (name.endsWith('.eth')) {
    // log.info('chainHelper.canTranslate:', name);
    return true;
  }

  return false;
}

export async function translateNameToPhoneNumber(
  name: string
): Promise<TranslateResult> {
  const result: TranslateResult = { name };

  const lookupUrl = 'https://ethercache.herokuapp.com/lookup';
  const resp = await got.get(lookupUrl, {
    searchParams: { name },
    timeout: { request: 10_000 },
    throwHttpErrors: false,
  });

  const contentType = resp.headers['content-type'];
  const contentLen = Number(resp.headers['content-length'] || '');

  if (contentLen > 0 && contentType?.startsWith('application/json')) {
    const lookupResult: LookupResult = JSON.parse(resp.body);
    result.address = lookupResult.address;

    const statusClass = Math.round(resp.statusCode / 100);
    switch (statusClass) {
      case 2:
        if (!lookupResult.phone) lookupResult.phone = getFakeNumberFor(name);
        result.phoneNumber = cleanPhoneNumber(lookupResult.phone);
        if (!result.phoneNumber) result.error = 'no phone record found';
        break;
      case 4:
        result.error = lookupResult.message;
        break;
      default:
    }
  } else {
    result.error = `unknown failure from ${lookupUrl}: ${resp.statusCode} ${resp.statusMessage}`;
  }

  const logFn = result.error ? log.error : log.info;
  logFn('chainHelper.translate:', result);
  return result;
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

// FIXME: remove this crap once we have folks w/ real numbers
function getFakeNumberFor(name: string): string {
  const val = window.localStorage.getItem(`fake-${name}`);
  log.warn('chainHelper.fake:', name, val);
  return val || '';
}
