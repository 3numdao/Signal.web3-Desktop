import md5 from 'md5';
import yaml from 'js-yaml';

import { PathName } from './PathName';
import { report } from './telemetry';

export interface Env {
  RELEASES_AUTH_KEY: string;
  LATEST_CACHE_TTL: number;
  RELEASES_BUCKET: R2Bucket;
  LATEST_CACHE: KVNamespace;
}

type ManifestFile = {
  url: string;
  sha512: string;
  size: number;
};

type Manifest = {
  version: string;
  files: ManifestFile[];
  path: string;
  sha512: string;
};

const ALLOW_LIST = [
  '^static/',
  '^desktop/[^/]+.yml$',
  '^desktop/signal.web3-desktop[-_][^/]+$',
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

        const pathname = await getReleasesKey(env, key);
        const object = await env.RELEASES_BUCKET.get(pathname.toString());

        if (!object || !object.body) {
          return new Response('Object Not Found', { status: 404 });
        }

        if (pathname.ext != 'yml') {
          const props = getNameProperties(pathname.base);
          if (props) {
            // make all requests effectively unique (no reliable way to know who's calling)
            const ip = request.headers.get('CF-Connecting-IP');
            props.distinct_id = md5(`${ip}${new Date()}`);
            props['$ip'] = ip;
            await report('download', props);
          }
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);

        setCacheControl(headers);

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

async function getReleasesKey(env: Env, key: string): Promise<PathName> {
  const pathname = new PathName(key);
  if (!pathname.ext || !pathname.base.match(/[-_]latest[_.]/)) {
    return pathname;
  }

  const cachedKey = await env.LATEST_CACHE.get(pathname.ext);
  if (cachedKey) {
    console.log('returning', cachedKey, '(cached)');
    return new PathName(cachedKey);
  }

  let manifestExt: string;
  switch (pathname.ext) {
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
      console.error('unable to get latest object (unsupported key)', pathname);
      return pathname;
  }

  const manifestKey = `${pathname.dir}/latest${manifestExt}.yml`;
  const manifestObj = await env.RELEASES_BUCKET.get(manifestKey);
  if (!manifestObj || !manifestObj.body) {
    console.error(`unable to get ${manifestKey}: object not found`);
    return pathname;
  }

  const body = await manifestObj.text();
  const manifest: Manifest = yaml.load(body);

  const latestUrl = pathname.base.replace('latest', manifest.version);
  let latestKey: string = '';
  for (const mf of manifest.files) {
    if (mf.url == latestUrl) {
      latestKey = `${pathname.dir}/${mf.url}`;
      break;
    }
  }

  if (!latestKey) {
    console.error(`unable to find match for ${pathname} in`, manifest);
    return pathname;
  }

  await env.LATEST_CACHE.put(pathname.ext, latestKey, {
    expirationTtl: env.LATEST_CACHE_TTL || 300,
  });

  console.log('returning', latestKey);
  return new PathName(latestKey);
}

const macRE = new RegExp('-mac-([^-]+)-(.+)\\.((dmg|zip).*)$');
const winRE = new RegExp('-win-([^-]+)-(.+)\\.(exe.*)$');
const linRE = new RegExp('_([^_]+)_([^.]+)\\.(deb.*)$');

function getNameProperties(name: string): any {
  // using NodeJS `Platform` values (to match what is reported from the clients)
  let properties;
  let match = name.match(macRE);
  if (match) {
    properties = {
      platform: 'darwin',
      arch: match[1],
      version: match[2],
      ext: match[3],
    };
  } else {
    match = name.match(winRE);
    if (match) {
      properties = {
        platform: 'win32',
        arch: match[1],
        version: match[2],
        ext: match[3],
      };
    } else {
      match = name.match(linRE);
      if (match) {
        properties = {
          platform: 'linux',
          version: match[1],
          arch: match[2],
          ext: match[3],
        };
      } else {
        console.error('unable to parse platform/arch:', name);
      }
    }
  }

  return properties;
}

function setCacheControl(headers: Headers) {
  // use same settings as what official Signal service reports
  // (300 seconds--yes, even for large binaries)
  const expiry = 300;
  const expires = new Date(Date.now() + expiry * 1000);
  headers.set('expires', expires.toUTCString());
  headers.set('cache-control', `public, max-age=${expiry}`);
}

function methodNotAllowed(): Response | PromiseLike<Response> {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'PUT, GET, DELETE',
    },
  });
}
