import { Project } from '../../../domain/entities/Project';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
export type CleanStaleTmuxSessionsParams = {
    project: Project;
    allowCacheMinutes: number;
    issueRepository: Pick<IssueRepository, 'getAllOpened'>;
    localCommandRunner: LocalCommandRunner;
    now: Date;
};
export declare const cleanStaleTmuxSessions: (params: CleanStaleTmuxSessionsParams) => Promise<void>;
//# sourceMappingURL=staleTmuxSessionCleaner.d.ts.map