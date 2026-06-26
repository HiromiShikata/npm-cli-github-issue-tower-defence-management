import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
export declare const DEFAULT_EXCLUDED_STATUS = "In Tmux by human";
export declare const DEFAULT_IDLE_THRESHOLD_SECONDS: number;
export declare class StaleTmuxSessionKillUseCase {
    private readonly issueRepository;
    private readonly tmuxSessionRepository;
    constructor(issueRepository: Pick<IssueRepository, 'getAllOpened'>, tmuxSessionRepository: Pick<TmuxSessionRepository, 'listLiveSessionsWithActivity' | 'killSession'>);
    run: (params: {
        project: Project;
        allowCacheMinutes: number;
        excludedStatus: string;
        idleThresholdSeconds: number;
        now: Date;
    }) => Promise<void>;
    private evaluateKillReason;
}
//# sourceMappingURL=StaleTmuxSessionKillUseCase.d.ts.map