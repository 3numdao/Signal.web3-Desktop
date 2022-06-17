import mime from 'mime/lite';

export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;

  RELEASES_AUTH_KEY: string;
  RELEASES_BUCKET: R2Bucket;
}

const ALLOW_LIST = [
  '^static/',
  '^desktop/[^/]+.yml$',
  '^desktop/signal-ens-desktop-[^/]+$',
];

// Check requests for a pre-shared secret
const hasValidHeader = (request: Request, env: Env) => {
  return request.headers.get('X-Custom-Auth-Key') === env.RELEASES_AUTH_KEY;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);

    if (!authorizeRequest(request, env, key)) {
      return new Response('Forbidden', { status: 403 });
    }

    switch (request.method) {
      case 'PUT':
        await env.RELEASES_BUCKET.put(key, request.body);
        return new Response(`Put ${key} successfully!`);
      case 'GET':
        if (key.startsWith('static/')) {
          const upstream = `https://updates2.signal.org/${key}`;
          console.log('Proxying:', upstream);
          return fetch(upstream);
        }

        const object = await env.RELEASES_BUCKET.get(key);

        if (!object || !object.body) {
          return new Response('Object Not Found', { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);

        setCacheControl(headers, key);
        setContentType(headers, key);

        return new Response(object.body, {
          headers,
        });
      case 'DELETE':
        await env.RELEASES_BUCKET.delete(key);
        return new Response('Deleted!');

      default:
        return new Response('Method Not Allowed', {
          status: 405,
          headers: {
            Allow: 'PUT, GET, DELETE',
          },
        });
    }
  },
};

function authorizeRequest(request: Request, env: Env, key: string) {
  switch (request.method) {
    case 'PUT':
    case 'DELETE':
      return hasValidHeader(request, env);
    case 'GET':
      if (hasValidHeader(request, env)) {
        return true; // let authenticated requests look at all keys
      }

      for (let exp of ALLOW_LIST) {
        const re = new RegExp(exp);
        if (re.test(key)) return true;
      }
  }

  return false;
}

function setCacheControl(headers: Headers, key: string) {
  // use same settings as what official Signal service reports
  // (300 seconds--yes, even for large binaries)
  const expiry = 300;
  const expires = new Date(Date.now() + expiry * 1000);
  headers.set('expires', expires.toUTCString());
  headers.set('cache-control', `public, max-age=${expiry}`);
}

function setContentType(headers: Headers, key: string) {
  const ext = getExt(key);

  // the mime helper provides the more generic octet-stream type for some extensions,
  // so we'll be explicit here (to emulate what Signal uses)
  let typ: string;
  switch (ext) {
    case 'dmg':
      typ = 'application/x-apple-diskimage';
      break;
    case 'exe':
      typ = 'application/x-msdownload';
      break;
    default:
      typ = mime.getType(ext) || 'application/octet-stream';
  }

  headers.set('content-type', typ);
}

function getExt(filename: string): string {
  return (
    filename.substring(filename.lastIndexOf('.') + 1, filename.length) ||
    filename
  );
}
