import telemetryJson from '../../.telemetry.json';
import packageJson from '../../package.json';

import { hash, HashType } from '../Crypto';
import * as log from '../logging/log';
import * as Bytes from '../Bytes';

import { commonGot as got } from './CommonGot';

export async function report(event: string, properties = {}): Promise<void> {
  if (!telemetryJson.api_key) {
    log.warn('telemetry report disabled:', event, properties);
    return;
  }

  try {
    const defaultProps = {
      distinct_id: 'unknown',
      version: packageJson.version,
      platform: process.platform,
      arch: process.arch,
    };

    if (!('distinct_id' in properties)) {
      let distinctId;
      const ourUuid = window.textsecure.storage.user.getUuid()?.toString();
      if (ourUuid) {
        distinctId = ourUuid;
      } else {
        distinctId =
          window.textsecure.storage.user.getNumber() ||
          defaultProps.distinct_id;
      }

      // obfuscate these so the telemetry service doesn't see the real values...
      defaultProps.distinct_id = Bytes.toHex(
        hash(HashType.size256, Bytes.fromString(distinctId))
      );
    }

    const props = { ...defaultProps, ...properties };

    await got.post('https://app.posthog.com/capture', {
      json: {
        api_key: telemetryJson.api_key,
        event,
        properties: props,
        timestamp: new Date(),
      },
    });

    log.info('telemetry report:', event, props);
  } catch (err) {
    log.warn(`telemetry report ${event} failed:`, err);
  }
}
