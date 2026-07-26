import type { Issue } from '../../../domain/entities/Issue';
import { TokenRateLimitSnapshot, TokenStatus } from '../../../domain/usecases/dashboard/GenerateTokenStatusUseCase';
import { ClaudeInteractiveSessionRepository } from '../../../domain/usecases/adapter-interfaces/ClaudeInteractiveSessionRepository';
import { TakeOwnershipSpawnRepository } from '../../../domain/usecases/adapter-interfaces/TakeOwnershipSpawnRepository';
import { RateLimitSnapshot } from '../../proxy/RateLimitCache';
export type TokenStatusWriterParams = {
    dashboardDataDir: string | null | undefined;
    tokenListJsonPath: string | null | undefined;
    issues: Issue[];
    pjcode?: string | null | undefined;
    now?: Date;
    readSnapshot?: (token: string) => RateLimitSnapshot | null;
    interactiveSessionRepository?: ClaudeInteractiveSessionRepository;
    spawnRepository?: TakeOwnershipSpawnRepository;
};
export type TokenStatusFile = {
    tokens: TokenStatus[];
    capturedAt: string;
};
export declare const toTokenRateLimitSnapshot: (snapshot: RateLimitSnapshot | null) => TokenRateLimitSnapshot | null;
export declare const writeTokenStatus: (params: TokenStatusWriterParams) => void;
//# sourceMappingURL=tokenStatusWriter.d.ts.map