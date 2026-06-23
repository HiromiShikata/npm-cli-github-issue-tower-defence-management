import { ClaudeLiveSessionRepository } from '../../../domain/usecases/adapter-interfaces/ClaudeLiveSessionRepository';
import { LiveSessionOauthTokenSelectUseCase } from '../../../domain/usecases/LiveSessionOauthTokenSelectUseCase';
export type LiveSessionOauthTokenSelectHandlerInput = {
    tokenListJsonPath: string | null;
    cacheDirectory: string | null;
    nowEpochSeconds: number;
};
export type LiveSessionOauthTokenSelectHandlerOutput = {
    selectedToken: string | null;
    selectedName: string | null;
    diagnostics: string[];
};
export declare class LiveSessionOauthTokenSelectHandler {
    private readonly useCase;
    private readonly liveSessionRepository;
    constructor(useCase?: LiveSessionOauthTokenSelectUseCase, liveSessionRepository?: ClaudeLiveSessionRepository);
    handle: (input: LiveSessionOauthTokenSelectHandlerInput) => LiveSessionOauthTokenSelectHandlerOutput;
    private formatDiagnostics;
}
//# sourceMappingURL=LiveSessionOauthTokenSelectHandler.d.ts.map