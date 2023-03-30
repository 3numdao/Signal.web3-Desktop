// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import libphonenumber from 'google-libphonenumber';
import type { PhoneNumber } from 'google-libphonenumber';
import { canTranslateNameToPhoneNumber } from './chainHelper';

const instance = libphonenumber.PhoneNumberUtil.getInstance();
const { PhoneNumberFormat } = libphonenumber;

export { instance, PhoneNumberFormat };

export type ParsedE164Type = Readonly<{
  isValid: boolean;
  userInput: string;
  e164: string;
}>;

export function parseAndFormatPhoneNumber(
  str: string,
  regionCode: string | undefined,
  format = PhoneNumberFormat.E164
): ParsedE164Type | undefined {
  let result: PhoneNumber | undefined;
  try {
    result = instance.parse(str, regionCode);
  } catch (err) {
    /* empty */
  }

  const isValid = result ? instance.isValidNumber(result) : false;

  if (!isValid && canTranslateNameToPhoneNumber(str)) {
    return {
      isValid: true,
      userInput: str,
      e164: str,
    };
  }

  if (!result) {
    return undefined;
  }

  return {
    isValid,
    userInput: str,
    e164: instance.format(result, format),
  };
}
