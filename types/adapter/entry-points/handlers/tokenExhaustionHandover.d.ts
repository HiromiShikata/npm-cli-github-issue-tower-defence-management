import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
export type HandleTokenExhaustionHandoverParams = {
    enabled: boolean;
    localCommandRunner: LocalCommandRunner;
    handoverMessageText: string;
    gracePeriodSeconds: number;
    rateLimitStaleThresholdSeconds: number;
    tokenRateLimitSnapshotBaseDir: string | null;
    nowEpochSeconds: number;
};
export declare const handleTokenExhaustionHandover: (params: HandleTokenExhaustionHandoverParams) => Promise<void>;
export declare const DEFAULT_HANDLE_TOKEN_EXHAUSTION_HANDOVER_PARAMS: Pick<HandleTokenExhaustionHandoverParams, 'handoverMessageText' | 'gracePeriodSeconds' | 'rateLimitStaleThresholdSeconds'>;
//# sourceMappingURL=tokenExhaustionHandover.d.ts.map