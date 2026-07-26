import * as http from 'http';
import * as https from 'https';
import {
  PROXY_PORT,
  hashToken,
  isFableModel,
  parseModelRateLimitsFromBody,
  parseSevenDayRejection,
  writeFableRejection,
  writeModelRateLimit,
  writeRateLimit,
  writeSubscriptionDisabled,
} from './RateLimitCache';
import { ClaudeMessageResponseRepository } from '../../domain/usecases/adapter-interfaces/ClaudeMessageResponseRepository';
import { parseClaudeMessageResponse } from './ClaudeMessageResponseParser';
import { SqliteClaudeMessageResponseRepository } from '../repositories/SqliteClaudeMessageResponseRepository';

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isPermissionError = (body: string): boolean => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  if (!isRecord(parsed)) return false;
  const error = parsed.error;
  if (!isRecord(error)) return false;
  return error.type === 'permission_error';
};

const matchModelInBody = (requestBody: string): string | null => {
  const match = requestBody.match(/"model"\s*:\s*"([^"]+)"/);
  return match !== null ? match[1] : null;
};

const extractRequestModel = (requestBody: string): string | null => {
  try {
    const parsed: unknown = JSON.parse(requestBody);
    if (isRecord(parsed) && typeof parsed.model === 'string') {
      return parsed.model;
    }
    return null;
  } catch {
    return matchModelInBody(requestBody);
  }
};

const parseRetryAfterSeconds = (
  headers: http.IncomingHttpHeaders,
): number | null => {
  const raw = headers['retry-after'];
  const value =
    typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : null;
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const startProxy = (
  port: number,
  claudeMessageResponseRepository: ClaudeMessageResponseRepository | null = null,
): http.Server => {
  const server = http.createServer((clientRequest, clientResponse) => {
    const token = extractToken(clientRequest.headers['authorization']);
    const requestChunks: Uint8Array[] = [];
    let requestBytes = 0;
    if (token !== null) {
      clientRequest.on('data', (chunk: Buffer) => {
        if (requestBytes >= MAX_INSPECTED_BODY_BYTES) return;
        requestChunks.push(new Uint8Array(chunk));
        requestBytes += chunk.length;
      });
    }
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
            writeRateLimit(
              token,
              upstreamResponse.headers,
              upstreamResponse.statusCode ?? null,
            );
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
            const body = Buffer.concat(inspectedChunks).toString('utf8');
            try {
              const limits = parseModelRateLimitsFromBody(body);
              writeModelRateLimit(token, limits);
            } catch (error) {
              console.error('Failed to write model rate limit cache:', error);
            }
            if (
              body.includes(
                'Your organization has disabled Claude subscription access for Claude Code',
              ) ||
              (upstreamResponse.statusCode === 403 && isPermissionError(body))
            ) {
              try {
                writeSubscriptionDisabled(token);
              } catch (error) {
                console.error(
                  'Failed to write subscription disabled cache:',
                  error,
                );
              }
            }
            if (upstreamResponse.statusCode === 429) {
              try {
                const requestModel = extractRequestModel(
                  Buffer.concat(requestChunks).toString('utf8'),
                );
                if (isFableModel(requestModel)) {
                  const { sevenDayRejected, sevenDayReset } =
                    parseSevenDayRejection(upstreamResponse.headers);
                  if (sevenDayRejected) {
                    writeFableRejection(
                      token,
                      parseRetryAfterSeconds(upstreamResponse.headers),
                      sevenDayReset,
                    );
                  }
                }
              } catch (error) {
                console.error('Failed to write fable rejection cache:', error);
              }
            }
            if (claudeMessageResponseRepository !== null) {
              try {
                const response = parseClaudeMessageResponse(
                  hashToken(token),
                  upstreamResponse.statusCode ?? 0,
                  upstreamResponse.headers,
                  body,
                );
                claudeMessageResponseRepository.append(response);
              } catch (error) {
                console.error(
                  'Failed to record Claude message response:',
                  error,
                );
              }
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
  return server;
};

if (require.main === module) {
  const dbPath = './db/claude_message_response.db';
  const repository = new SqliteClaudeMessageResponseRepository(dbPath);
  startProxy(PROXY_PORT, repository);
}

export { startProxy, extractToken };
