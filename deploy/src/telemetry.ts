import telemetryJson from '../../.telemetry.json';

export async function report(event: string, properties = {}): Promise<void> {
  if (!telemetryJson.api_key) {
    console.warn('telemetry report requested without API key:', event);
    return;
  }

  try {
    const json = {
      api_key: telemetryJson.api_key,
      event,
      properties,
      timestamp: new Date(),
    };

    const req = new Request('https://app.posthog.com/capture', {
      method: 'post',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(json),
    });

    await fetch(req);
    console.log('telemetry report:', event, properties);
  } catch (err) {
    console.error(`telemetry report ${event} failed:`, err);
  }
}
