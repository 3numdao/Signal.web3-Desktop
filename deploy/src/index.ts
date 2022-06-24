import yaml from 'js-yaml';

export interface Env {
  RELEASES_AUTH_KEY: string;
  LATEST_CACHE_TTL: number;
  RELEASES_BUCKET: R2Bucket;
  LATEST_CACHE: KVNamespace;
}

type PathElements = {
  dir: string;
  base: string;
  ext: string;
};

const ALLOW_LIST = [
  '^static/',
  '^desktop/[^/]+.yml$',
  '^desktop/signal-ens-desktop[-_][^/]+$',
];

// Check requests for a pre-shared secret
const hasValidHeader = (request: Request, env: Env) => {
  return request.headers.get('X-Custom-Auth-Key') === env.RELEASES_AUTH_KEY;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    let key = url.pathname.slice(1);

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

        key = await getReleasesKey(env, key);
        const object = await env.RELEASES_BUCKET.get(key);

        if (!object || !object.body) {
          return new Response('Object Not Found', { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);

        setCacheControl(headers, key);

        return new Response(object.body, {
          headers,
        });
      case 'DELETE':
        await env.RELEASES_BUCKET.delete(key);
        return new Response('Deleted!');

      default:
        return methodNotAllowed();
    }
  },
};

function authorizeRequest(request: Request, env: Env, key: string): boolean {
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

async function getReleasesKey(env: Env, key: string): Promise<string> {
  const elements = pathSplit(key);
  if (!elements.base.match(/[-_]latest[_.]/)) return key;

  const ext = getExt(key);
  const cachedKey = await env.LATEST_CACHE.get(ext);
  if (cachedKey) {
    console.log('returning', cachedKey, '(cached)')
    return cachedKey;
  }

  let manifestExt: string;
  switch (ext) {
    case 'dmg':
      manifestExt = '-mac';
      break;
    case 'exe':
      manifestExt = '';
      break;
    case 'deb':
      manifestExt = '-linux';
      break;
    default:
      console.error('unable to get latest object (unsupported key)', key);
      return key;
  }

  const manifestKey = `${elements.dir}/latest${manifestExt}.yml`;
  const manifestObj = await env.RELEASES_BUCKET.get(manifestKey);
  if (!manifestObj || !manifestObj.body) {
    console.error(`unable to get ${manifestKey}: object not found`);
    return key;
  }

  type Manifest = { path: string }; // don't care about any of the other keys
  const body = await manifestObj.text();
  const manifest: Manifest = yaml.load(body);

  const latestKey = `${elements.dir}/${manifest.path}`;
  await env.LATEST_CACHE.put(ext, latestKey, {
    expirationTtl: env.LATEST_CACHE_TTL || 300,
  });

  console.log('returning', latestKey);
  return latestKey;
}

function setCacheControl(headers: Headers, key: string) {
  // use same settings as what official Signal service reports
  // (300 seconds--yes, even for large binaries)
  const expiry = 300;
  const expires = new Date(Date.now() + expiry * 1000);
  headers.set('expires', expires.toUTCString());
  headers.set('cache-control', `public, max-age=${expiry}`);
}

function pathSplit(filename: string): PathElements {
  const lastSlash = filename.lastIndexOf('/');
  return {
    ext: getExt(filename),
    base: filename.substring(lastSlash + 1, filename.length),
    dir: filename.substring(0, lastSlash),
  };
}

function getExt(filename: string): string {
  return (
    filename.substring(filename.lastIndexOf('.') + 1, filename.length) ||
    filename
  );
}

function methodNotAllowed(): Response | PromiseLike<Response> {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'PUT, GET, DELETE',
    },
  });
}
