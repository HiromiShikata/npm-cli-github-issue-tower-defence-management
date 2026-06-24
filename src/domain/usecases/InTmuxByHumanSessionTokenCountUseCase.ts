import { Issue } from '../entities/Issue';
import { IN_TMUX_STATUS_NAME } from '../entities/WorkflowStatus';
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

export class InTmuxByHumanSessionTokenCountUseCase {
  run = (
    candidates: OauthTokenCandidate[],
    interactiveSessions: ClaudeInteractiveSession[],
    issues: Issue[],
  ): InTmuxByHumanSessionTokenCountResult => {
    const inTmuxByHumanIssueUrls = this.inTmuxByHumanIssueUrls(issues);
    const distinctSessionIdsByToken = this.distinctSessionIdsByToken(
      interactiveSessions,
      inTmuxByHumanIssueUrls,
    );

    const counts = candidates.map((candidate) => ({
      name: candidate.name,
      token: candidate.token,
      count: distinctSessionIdsByToken.get(candidate.token)?.size ?? 0,
    }));

    return { counts };
  };

  private inTmuxByHumanIssueUrls = (issues: Issue[]): Set<string> => {
    const urls = new Set<string>();
    for (const issue of issues) {
      if (issue.status === IN_TMUX_STATUS_NAME && issue.isClosed === false) {
        urls.add(issue.url);
      }
    }
    return urls;
  };

  private distinctSessionIdsByToken = (
    interactiveSessions: ClaudeInteractiveSession[],
    inTmuxByHumanIssueUrls: Set<string>,
  ): Map<string, Set<string>> => {
    const sessionIdsByToken = new Map<string, Set<string>>();
    for (const session of interactiveSessions) {
      if (!inTmuxByHumanIssueUrls.has(session.issueUrl)) {
        continue;
      }
      const sessionIds =
        sessionIdsByToken.get(session.token) ?? new Set<string>();
      sessionIds.add(session.sessionId);
      sessionIdsByToken.set(session.token, sessionIds);
    }
    return sessionIdsByToken;
  };
}
