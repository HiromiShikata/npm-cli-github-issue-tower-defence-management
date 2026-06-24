import { Issue } from '../entities/Issue';
import { ClaudeInteractiveSession } from './adapter-interfaces/ClaudeInteractiveSessionRepository';
import { OauthTokenCandidate } from './OauthTokenSelectUseCase';
export type InTmuxByHumanSessionTokenCount = {
    name: string;
    token: string;
    count: number;
};
export type InTmuxByHumanSessionTokenCountResult = {
    counts: InTmuxByHumanSessionTokenCount[];
};
export declare class InTmuxByHumanSessionTokenCountUseCase {
    run: (candidates: OauthTokenCandidate[], interactiveSessions: ClaudeInteractiveSession[], issues: Issue[]) => InTmuxByHumanSessionTokenCountResult;
    private inTmuxByHumanIssueUrls;
    private distinctSessionIdsByToken;
}
//# sourceMappingURL=InTmuxByHumanSessionTokenCountUseCase.d.ts.map