import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
export type TokenExhaustionHandoverParams = {
    enabled: boolean;
    tokenListJsonPath: string | null;
    handoverMessage?: string | null;
    bareNameLeaderHandoverMessage?: string | null;
    tokenRateLimitSnapshotBaseDir?: string | null;
    gracePeriodSeconds?: number | null;
    stateFilePath?: string | null;
    localCommandRunner: LocalCommandRunner;
    now: Date;
};
export declare const handleTokenExhaustionHandover: (params: TokenExhaustionHandoverParams) => Promise<void>;
//# sourceMappingURL=tokenExhaustionHandover.d.ts.map