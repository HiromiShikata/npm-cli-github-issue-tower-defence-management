import * as http from 'http';
import * as https from 'https';
import { PROXY_PORT, writeRateLimit } from './RateLimitCache';

const UPSTREAM_HOST = 'api.anthropic.com';

const extractToken = (
  authorization: string | string[] | undefined,
): string | null => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (typeof value !== 'string') return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const startProxy = (port: number): void => {
  const server = http.createServer((clientRequest, clientResponse) => {
    const token = extractToken(clientRequest.headers['authorization']);
    const upstreamHeaders: Record<string, string | string[] | undefined> = {
      ...clientRequest.headers,
      host: UPSTREAM_HOST,
    };
    const upstreamRequest = https.request(
      {
        host: UPSTREAM_HOST,
        port: 443,
        method: clientRequest.method,
        path: clientRequest.url,
        headers: upstreamHeaders,
      },
      (upstreamResponse) => {
        if (token !== null) {
          try {
            writeRateLimit(token, upstreamResponse.headers);
          } catch (error) {
            console.error('Failed to write rate limit cache:', error);
          }
        }
        clientResponse.writeHead(
          upstreamResponse.statusCode ?? 502,
          upstreamResponse.headers,
        );
        upstreamResponse.pipe(clientResponse);
      },
    );
    upstreamRequest.on('error', (error) => {
      console.error('Upstream request error:', error.message);
      if (!clientResponse.headersSent) {
        clientResponse.writeHead(502, { 'content-type': 'text/plain' });
      }
      clientResponse.end('Upstream error');
    });
    clientRequest.pipe(upstreamRequest);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`tdpm proxy listening on 127.0.0.1:${port}`);
  });
};

if (require.main === module) {
  startProxy(PROXY_PORT);
}

export { startProxy };
