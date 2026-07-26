import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { ProcessEnvironReader } from '../../../domain/usecases/adapter-interfaces/ProcessEnvironReader';
export type ResetDegeneratedTmuxSessionsParams = {
    enabled: boolean;
    localCommandRunner: LocalCommandRunner;
    processEnvironReader?: ProcessEnvironReader;
    warningMessage: string;
    graceSeconds: number;
    cooldownSeconds: number;
    cooldownStateFilePath: string | null;
    now: Date;
};
export declare const resetDegeneratedTmuxSessions: (params: ResetDegeneratedTmuxSessionsParams) => Promise<void>;
export declare const DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS: {
    readonly warningMessage: "OUTPUT DEGENERATION DETECTED: your session is about to be reset. Immediately write a checkpoint to your assigned task issue (single concrete next action to resume, working directory and branch, in-flight sub-agent branch/PR URLs).";
    readonly graceSeconds: 5;
    readonly cooldownSeconds: 300;
};
//# sourceMappingURL=resetDegeneratedTmuxSessions.d.ts.map