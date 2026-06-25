import { Issue } from '../../entities/Issue';
import { TmuxSessionRepository } from '../adapter-interfaces/TmuxSessionRepository';
export type InTmuxByHumanSessionReconcileInput = {
    issues: Issue[];
    assigneeLogin: string;
    launcherCommand: string;
    now: Date;
};
export type InTmuxByHumanSessionReconcileResult = {
    launchedIssueUrls: string[];
};
export declare const toTmuxSessionName: (issueUrl: string) => string;
export declare class InTmuxByHumanSessionReconcileUseCase {
    private readonly tmuxSessionRepository;
    constructor(tmuxSessionRepository: TmuxSessionRepository);
    run: (input: InTmuxByHumanSessionReconcileInput) => Promise<InTmuxByHumanSessionReconcileResult>;
    private isInTmuxByHuman;
    private hasLiveSession;
}
//# sourceMappingURL=InTmuxByHumanSessionReconcileUseCase.d.ts.map