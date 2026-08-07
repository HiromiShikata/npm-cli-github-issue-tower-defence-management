import { ClaudeLiveSessionRepository } from '../../../domain/usecases/adapter-interfaces/ClaudeLiveSessionRepository';
import { LiveSessionOauthTokenSelectUseCase } from '../../../domain/usecases/LiveSessionOauthTokenSelectUseCase';
import { SelectionRandom } from '../../../domain/usecases/OauthTokenSelectUseCase';
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
    private readonly random;
    constructor(useCase?: LiveSessionOauthTokenSelectUseCase, liveSessionRepository?: ClaudeLiveSessionRepository, random?: SelectionRandom);
    handle: (input: LiveSessionOauthTokenSelectHandlerInput) => LiveSessionOauthTokenSelectHandlerOutput;
    private formatDiagnostics;
}
//# sourceMappingURL=LiveSessionOauthTokenSelectHandler.d.ts.map