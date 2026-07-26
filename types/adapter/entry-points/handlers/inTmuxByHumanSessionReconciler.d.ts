import { Issue } from '../../../domain/entities/Issue';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
export type ReconcileInTmuxByHumanSessionsParams = {
    inTmuxLauncherCommand: string | null;
    assigneeLogin: string;
    issues: Issue[];
    localCommandRunner: LocalCommandRunner;
    issueStateRepository: Pick<IssueRepository, 'getIssueOrPullRequestState'>;
    now: Date;
};
export declare const reconcileInTmuxByHumanSessions: (params: ReconcileInTmuxByHumanSessionsParams) => Promise<void>;
//# sourceMappingURL=inTmuxByHumanSessionReconciler.d.ts.map