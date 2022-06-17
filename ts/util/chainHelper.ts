// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JsonRpcProvider } from '@ethersproject/providers/lib/json-rpc-provider';
import { providers as etherProviders } from 'ethers';
import * as log from '../logging/log';
import { parseNumber } from './libphonenumberUtil';

export type TranslateResult = {
  name?: string;
  address?: string;
  phoneNumber?: string;
  error?: string;
};

export function canTranslateNameToPhoneNumber(name: string): boolean {
  if (getEtherProvider()) {
    if (name.endsWith('.eth')) {
      log.info('chainHelper.canTranslate:', name);
      return true;
    }
  }

  return false;
}

export async function translateNameToPhoneNumber(
  name: string
): Promise<TranslateResult> {
  const result: TranslateResult = { name };
  const etherProvider = getEtherProvider();
  if (!etherProvider) {
    result.error = 'no ether provider available';
  } else {
    const resolver = await etherProvider.getResolver(name);
    if (!resolver) {
      result.error = 'failed to get an ether resolver';
    } else {
      result.address = await resolver.getAddress();
      let phoneRecord = await resolver.getText('phone');
      if (!phoneRecord) phoneRecord = getFakeNumberFor(name);
      const phoneNumber = cleanPhoneNumber(phoneRecord);
      if (!phoneNumber) {
        result.error = 'no phone record found';
      } else {
        result.phoneNumber = phoneNumber;
      }
    }
  }

  const logFn = result.error ? log.error : log.info;
  logFn('chainHelper.translate:', result);
  return result;
}

let haveChecked = false;
let etherProvider: JsonRpcProvider | undefined;

function getEtherProvider(): JsonRpcProvider | undefined {
  if (!haveChecked && window.Events) {
    const url = window.Events.getEtherProviderUrl();
    if (url) {
      etherProvider = new etherProviders.JsonRpcProvider(url);
      if (etherProvider) {
        log.info('chainHelper.getProvider:', etherProvider);
      } else {
        log.error(
          'chainHelper.getProvider: failed to get a new provider using',
          url
        );
      }
    } else {
      log.info('chainHelper.getProvider: not configured');
    }

    haveChecked = true;
  }

  return etherProvider;
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
