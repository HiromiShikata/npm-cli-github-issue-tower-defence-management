import { Issue } from '../../entities/Issue';
import { IN_TMUX_STATUS_NAME } from '../../entities/WorkflowStatus';
import { TmuxSessionRepository } from '../adapter-interfaces/TmuxSessionRepository';

export type InTmuxByHumanSessionReconcileInput = {
  issues: Issue[];
  assigneeLogin: string;
  launcherCommand: string;
};

export type InTmuxByHumanSessionReconcileResult = {
  launchedIssueUrls: string[];
};

export const toTmuxSessionName = (issueUrl: string): string =>
  issueUrl.replace(/[^a-zA-Z0-9]/g, '_');

export class InTmuxByHumanSessionReconcileUseCase {
  constructor(private readonly tmuxSessionRepository: TmuxSessionRepository) {}

  run = async (
    input: InTmuxByHumanSessionReconcileInput,
  ): Promise<InTmuxByHumanSessionReconcileResult> => {
    const { issues, assigneeLogin, launcherCommand } = input;

    const targetIssues = issues.filter((issue) =>
      this.isInTmuxByHuman(issue, assigneeLogin),
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
      await this.tmuxSessionRepository.launchDetachedSession(
        toTmuxSessionName(issue.url),
        launcherCommand,
        issue.url,
      );
      launchedIssueUrls.push(issue.url);
    }

    return { launchedIssueUrls };
  };

  private isInTmuxByHuman = (issue: Issue, assigneeLogin: string): boolean =>
    issue.status === IN_TMUX_STATUS_NAME &&
    issue.isClosed === false &&
    issue.assignees.includes(assigneeLogin);

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
