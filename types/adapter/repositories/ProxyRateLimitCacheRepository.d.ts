import { RateLimitCacheRepository } from '../../domain/usecases/adapter-interfaces/RateLimitCacheRepository';
import { TokenRateLimitCache } from '../../domain/usecases/adapter-interfaces/RateLimitCacheRepository';
export declare class ProxyRateLimitCacheRepository implements RateLimitCacheRepository {
    private readonly tokenListJsonPath;
    private readonly port;
    constructor(tokenListJsonPath: string | null, port?: number);
    getTokenRateLimitCaches: () => TokenRateLimitCache[];
    probeToken: (token: string) => Promise<void>;
}
//# sourceMappingURL=ProxyRateLimitCacheRepository.d.ts.map