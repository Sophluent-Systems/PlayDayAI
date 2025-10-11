import { nullUndefinedOrEmpty } from '@src/common/objects';

function pickFirstString(values = []) {
  if (!Array.isArray(values)) {
    return null;
  }
  for (let i = 0; i < values.length; i++) {
    const candidate = values[i];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

export function resolveWebsocketInfo(options = {}) {
  const protocolOverride = options.protocol;
  let httpProtocol = protocolOverride;

  if (nullUndefinedOrEmpty(httpProtocol)) {
    const protocolFromEnv = process?.env?.NEXT_PUBLIC_PROTOCOL;
    if (protocolFromEnv === 'HTTPS') {
      httpProtocol = 'https:';
    } else if (protocolFromEnv === 'HTTP') {
      httpProtocol = 'http:';
    }
  }

  if (httpProtocol !== 'http:' && httpProtocol !== 'https:') {
    httpProtocol = 'https:';
  }

  const isHttps = httpProtocol === 'https:';
  const scheme = isHttps ? 'wss' : 'ws';

  const hostCandidates = [
    options.wsHost,
    process?.env?.WS_PREFERRED_HOST,
    process?.env?.NEXT_PUBLIC_WS_HOST,
    process?.env?.WS_HOST,
    process?.env?.NEXT_PUBLIC_BASE_URL,
    process?.env?.BASE_URL,
    process?.env?.HOST,
    'localhost',
  ];

  const wsHost = pickFirstString(hostCandidates) || 'localhost';

  const portCandidates = [
    options.wsPort,
    process?.env?.WS_LOCAL_PORT,
    process?.env?.NEXT_PUBLIC_WS_PORT,
    process?.env?.PORT,
  ];

  const wsPort = pickFirstString(portCandidates);

  const rawPath =
    typeof options.path === 'string'
      ? options.path.trim()
      : (isHttps ? '/ws' : '');

  let normalizedPath = '';
  if (!nullUndefinedOrEmpty(rawPath)) {
    normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  }

  const portSegment = wsPort ? `:${wsPort}` : '';

  const url = `${scheme}://${wsHost}${portSegment}${normalizedPath}`;

  return {
    url,
    host: wsHost,
    port: wsPort || null,
    scheme,
    protocol: httpProtocol,
    path: normalizedPath,
  };
}

export default resolveWebsocketInfo;
