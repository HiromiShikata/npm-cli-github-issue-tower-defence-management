import * as http from 'http';
import { RateLimitCacheRepository } from '../../domain/usecases/adapter-interfaces/RateLimitCacheRepository';
import { TokenRateLimitCache } from '../../domain/usecases/adapter-interfaces/RateLimitCacheRepository';
import { PROXY_PORT, readRateLimit } from '../proxy/RateLimitCache';
import { loadTokens } from '../proxy/TokenListLoader';

const HAIKU_MODEL = 'claude-haiku-4-5';

const PROBE_REQUEST_BODY = JSON.stringify({
  model: HAIKU_MODEL,
  max_tokens: 1,
  messages: [{ role: 'user', content: 'hi' }],
});

export class ProxyRateLimitCacheRepository implements RateLimitCacheRepository {
  constructor(
    private readonly tokenListJsonPath: string | null,
    private readonly port: number = PROXY_PORT,
  ) {}

  getTokenRateLimitCaches = (): TokenRateLimitCache[] => {
    if (this.tokenListJsonPath === null) {
      return [];
    }
    const tokens = loadTokens(this.tokenListJsonPath);
    if (tokens === null) {
      return [];
    }
    return tokens.map((token) => {
      const snapshot = readRateLimit(token);
      const unifiedReset = snapshot !== null ? snapshot.fiveHourReset : 0;
      return { token, unifiedReset };
    });
  };

  probeToken = async (token: string): Promise<void> => {
    await new Promise<void>((resolve) => {
      const request = http.request(
        {
          host: '127.0.0.1',
          port: this.port,
          method: 'POST',
          path: '/v1/messages',
          headers: {
            'content-type': 'application/json',
            'anthropic-version': '2023-06-01',
            authorization: `Bearer ${token}`,
            'content-length': Buffer.byteLength(PROBE_REQUEST_BODY),
          },
        },
        (response) => {
          response.resume();
          response.on('end', () => resolve());
        },
      );
      request.on('error', (error) => {
        console.error(
          `[UpdateRateLimitCache] Probe request failed for token hash: ${error.message}`,
        );
        resolve();
      });
      request.write(PROBE_REQUEST_BODY);
      request.end();
    });
  };
}
