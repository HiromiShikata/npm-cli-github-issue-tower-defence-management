import { Issue } from '../../entities/Issue';
import { IN_TMUX_STATUS_NAME } from '../../entities/WorkflowStatus';
import { IssueRepository } from '../adapter-interfaces/IssueRepository';
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

// tmux sanitizes a requested session name by replacing only `.` and `:` with
// `_`, while keeping every other character (including `/`). The Termux app
// launches each agent with `tmux new -A -s {ISSUE_URL}`, so tmux derives the
// authoritative session name from the raw issue URL. This function MUST return
// exactly that derived name so the reconciler recognizes the app's existing
// session instead of creating a duplicate under a differently-normalized name.
// For example `https://github.com/owner/repo/issues/9` becomes
// `https_//github_com/owner/repo/issues/9`.
export const toTmuxSessionName = (issueUrl: string): string =>
  issueUrl.replace(/[.:]/g, '_');

export class InTmuxByHumanSessionReconcileUseCase {
  constructor(
    private readonly tmuxSessionRepository: TmuxSessionRepository,
    private readonly issueStateRepository: Pick<
      IssueRepository,
      'getIssueOrPullRequestState'
    >,
  ) {}

  run = async (
    input: InTmuxByHumanSessionReconcileInput,
  ): Promise<InTmuxByHumanSessionReconcileResult> => {
    const { issues, assigneeLogin, launcherCommand, now } = input;

    const targetIssues = issues.filter((issue) =>
      this.isInTmuxByHuman(issue, assigneeLogin, now),
    );
    if (targetIssues.length === 0) {
      return { launchedIssueUrls: [] };
    }

    const liveSessionNames = new Set(
      await this.tmuxSessionRepository.listLiveSessionNames(),
    );
    const processCommandLines =
      await this.tmuxSessionRepository.listInteractiveProcessCommandLines();

    const launchedIssueUrls: string[] = [];
    for (const issue of targetIssues) {
      if (
        this.hasLiveSession(issue.url, liveSessionNames, processCommandLines)
      ) {
        continue;
      }
      const liveState =
        await this.issueStateRepository.getIssueOrPullRequestState(issue.url);
      if (liveState.state.toLowerCase() !== 'open') {
        continue;
      }
      await this.tmuxSessionRepository.launchDetachedSession(
        toTmuxSessionName(issue.url),
        launcherCommand,
        issue.url,
      );
      launchedIssueUrls.push(issue.url);
    }

    return { launchedIssueUrls };
  };

  private isInTmuxByHuman = (
    issue: Issue,
    assigneeLogin: string,
    now: Date,
  ): boolean =>
    issue.status === IN_TMUX_STATUS_NAME &&
    issue.isClosed === false &&
    issue.assignees.includes(assigneeLogin) &&
    (issue.nextActionDate === null ||
      issue.nextActionDate.getTime() <= now.getTime()) &&
    issue.nextActionHour === null;

  private hasLiveSession = (
    issueUrl: string,
    liveSessionNames: Set<string>,
    processCommandLines: string[],
  ): boolean => {
    const sessionName = toTmuxSessionName(issueUrl);
    if (!liveSessionNames.has(sessionName)) {
      return false;
    }
    return processCommandLines.some((commandLine) =>
      commandLine.includes(issueUrl),
    );
  };
}
