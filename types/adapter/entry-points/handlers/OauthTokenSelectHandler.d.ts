import { OauthTokenSelectUseCase } from '../../../domain/usecases/OauthTokenSelectUseCase';
export type OauthTokenSelectHandlerInput = {
    tokenListJsonPath: string | null;
    cacheDirectory: string | null;
    nowEpochSeconds: number;
};
export type OauthTokenSelectHandlerOutput = {
    selectedToken: string | null;
    selectedName: string | null;
    diagnostics: string[];
};
export declare const resolveTokenListJsonPath: (explicitPath: string | null) => string | null;
export declare const resolveCacheDirectory: (explicitDirectory: string | null) => string;
export declare class OauthTokenSelectHandler {
    private readonly useCase;
    constructor(useCase?: OauthTokenSelectUseCase);
    handle: (input: OauthTokenSelectHandlerInput) => OauthTokenSelectHandlerOutput;
    private formatDiagnostics;
}
//# sourceMappingURL=OauthTokenSelectHandler.d.ts.map