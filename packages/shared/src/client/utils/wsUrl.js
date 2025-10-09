export function buildWebsocketUrl(options = {}) {
  const {
    wsHost: explicitHost,
    wsPort: explicitPort,
    protocol: explicitProtocol,
    path: customPath,
  } = options;

  // Check for NEXT_PUBLIC_PROTOCOL environment variable, falling back to window.location.protocol
  const envProtocol = process.env.NEXT_PUBLIC_PROTOCOL === 'HTTPS' ? 'https:' : 
                       process.env.NEXT_PUBLIC_PROTOCOL === 'HTTP' ? 'http:' : null;
  const protocol = explicitProtocol || envProtocol || (typeof window !== 'undefined' ? window.location.protocol : 'https:');
  const isHttps = protocol === 'https:';
  const scheme = isHttps ? 'wss' : 'ws';

  const fallbackHosts = [
    explicitHost,
    process.env.NEXT_PUBLIC_WS_HOST,
    typeof window !== 'undefined' ? window.location.hostname : undefined,
    process.env.NEXT_PUBLIC_WS_NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    'localhost',
  ];

  const wsHost = fallbackHosts.find((value) => typeof value === 'string' && value.trim().length > 0) || 'localhost';
  const wsPort = explicitPort ?? process.env.NEXT_PUBLIC_WS_PORT;

  const hasPortInHost = wsHost.includes(':') && !wsHost.startsWith('[');
  const portSegment = wsPort && !hasPortInHost ? `:${wsPort}` : '';

  const normalizedPath = typeof customPath === 'string'
    ? customPath
    : (isHttps ? '/ws' : '');

  return `${scheme}://${wsHost}${portSegment}${normalizedPath}`;
}
