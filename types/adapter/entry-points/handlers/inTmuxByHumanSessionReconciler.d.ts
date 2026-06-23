import { Issue } from '../../../domain/entities/Issue';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
export type ReconcileInTmuxByHumanSessionsParams = {
    inTmuxLauncherCommand: string | null;
    assigneeLogin: string;
    issues: Issue[];
    localCommandRunner: LocalCommandRunner;
};
export declare const reconcileInTmuxByHumanSessions: (params: ReconcileInTmuxByHumanSessionsParams) => Promise<void>;
//# sourceMappingURL=inTmuxByHumanSessionReconciler.d.ts.map