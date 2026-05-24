import * as http from 'http';
import * as https from 'https';
import {
  PROXY_PORT,
  parseModelRateLimitsFromBody,
  writeModelRateLimit,
  writeRateLimit,
} from './RateLimitCache';

const UPSTREAM_HOST = 'api.anthropic.com';

const MAX_INSPECTED_BODY_BYTES = 1024 * 1024;

const BEARER_PREFIX = 'bearer ';

const extractToken = (
  authorization: string | string[] | undefined,
): string | null => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (typeof value !== 'string') return null;
  if (value.length < BEARER_PREFIX.length) return null;
  if (value.slice(0, BEARER_PREFIX.length).toLowerCase() !== BEARER_PREFIX)
    return null;
  const token = value.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
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
          const inspectedChunks: Uint8Array[] = [];
          let inspectedBytes = 0;
          upstreamResponse.on('data', (chunk: Buffer) => {
            if (inspectedBytes >= MAX_INSPECTED_BODY_BYTES) return;
            inspectedChunks.push(new Uint8Array(chunk));
            inspectedBytes += chunk.length;
          });
          upstreamResponse.on('end', () => {
            try {
              const body = Buffer.concat(inspectedChunks).toString('utf8');
              const limits = parseModelRateLimitsFromBody(body);
              writeModelRateLimit(token, limits);
            } catch (error) {
              console.error('Failed to write model rate limit cache:', error);
            }
          });
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

export { startProxy, extractToken };
