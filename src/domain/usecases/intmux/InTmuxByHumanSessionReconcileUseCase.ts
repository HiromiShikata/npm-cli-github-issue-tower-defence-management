import { issueSessionIsOnHold } from '../issueSessionIsOnHold';
import { Issue } from '../../entities/Issue';
import { Project } from '../../entities/Project';
import { IN_TMUX_STATUS_NAME } from '../../entities/WorkflowStatus';
import { IssueRepository } from '../adapter-interfaces/IssueRepository';
import { TmuxSessionRepository } from '../adapter-interfaces/TmuxSessionRepository';

export type InTmuxByHumanSessionReconcileInput = {
  project: Project;
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
    private readonly issueStateRepository: Pick<IssueRepository, 'get'>,
  ) {}

  run = async (
    input: InTmuxByHumanSessionReconcileInput,
  ): Promise<InTmuxByHumanSessionReconcileResult> => {
    const { issues, assigneeLogin, launcherCommand, project } = input;

    const targetIssues = issues.filter((issue) =>
      this.isInTmuxByHuman(issue, assigneeLogin),
    );
    if (targetIssues.length === 0) {
      return { launchedIssueUrls: [] };
    }

    const processCommandLines =
      await this.tmuxSessionRepository.listInteractiveProcessCommandLines();

    const launchedIssueUrls: string[] = [];
    const failures: unknown[] = [];
    for (const issue of targetIssues) {
      try {
        if (this.hasLiveSession(issue.url, processCommandLines)) {
          continue;
        }
        const liveIssue = await this.issueStateRepository.get(
          issue.url,
          project,
        );
        if (
          liveIssue === null ||
          liveIssue.isClosed ||
          liveIssue.state.toLowerCase() !== 'open' ||
          issueSessionIsOnHold(liveIssue)
        ) {
          continue;
        }
        await this.tmuxSessionRepository.launchDetachedSession(
          toTmuxSessionName(issue.url),
          launcherCommand,
          issue.url,
        );
        launchedIssueUrls.push(issue.url);
      } catch (error) {
        console.error(
          `Failed to reconcile interactive session for ${issue.url}`,
          error,
        );
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw new Error(failures.map(String).join('; '));
    }

    return { launchedIssueUrls };
  };

  private isInTmuxByHuman = (issue: Issue, assigneeLogin: string): boolean =>
    issue.status === IN_TMUX_STATUS_NAME &&
    issue.isClosed === false &&
    issue.assignees.includes(assigneeLogin) &&
    !issueSessionIsOnHold(issue);

  private hasLiveSession = (
    issueUrl: string,
    processCommandLines: string[],
  ): boolean =>
    processCommandLines.some((commandLine) =>
      commandLine.split(/[\s'"]+/).includes(issueUrl),
    );
}
