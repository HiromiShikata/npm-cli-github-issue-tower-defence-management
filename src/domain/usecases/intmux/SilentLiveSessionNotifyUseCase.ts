import { Issue } from '../../entities/Issue';
import { IN_TMUX_STATUS_NAME } from '../../entities/WorkflowStatus';
import { TmuxSessionRepository } from '../adapter-interfaces/TmuxSessionRepository';
import { toTmuxSessionName } from './InTmuxByHumanSessionReconcileUseCase';

export type SilentLiveSessionNotifyInput = {
  issues: Issue[];
  assigneeLogin: string;
  now: Date;
};

export type SilentLiveSessionNotifyResult = {
  silentSessionIssueUrls: string[];
};

export class SilentLiveSessionNotifyUseCase {
  constructor(
    private readonly tmuxSessionRepository: Pick<
      TmuxSessionRepository,
      'listLiveSessionNames' | 'listInteractiveProcessCommandLines'
    >,
  ) {}

  run = async (
    input: SilentLiveSessionNotifyInput,
  ): Promise<SilentLiveSessionNotifyResult> => {
    const { issues, assigneeLogin, now } = input;

    const targetIssues = issues.filter((issue) =>
      this.isInTmuxByHuman(issue, assigneeLogin, now),
    );
    if (targetIssues.length === 0) {
      return { silentSessionIssueUrls: [] };
    }

    const liveSessionNames = new Set(
      await this.tmuxSessionRepository.listLiveSessionNames(),
    );
    const processCommandLines =
      await this.tmuxSessionRepository.listInteractiveProcessCommandLines();

    const silentSessionIssueUrls: string[] = [];
    for (const issue of targetIssues) {
      const sessionName = toTmuxSessionName(issue.url);
      if (!liveSessionNames.has(sessionName)) {
        continue;
      }
      if (processCommandLines.some((line) => line.includes(issue.url))) {
        continue;
      }
      silentSessionIssueUrls.push(issue.url);
    }

    if (silentSessionIssueUrls.length > 0) {
      console.log(
        `Silent live sessions detected: ${silentSessionIssueUrls.length} session(s) have a tmux window but no active Claude process.`,
      );
      for (const url of silentSessionIssueUrls) {
        console.log(`  - ${url}`);
      }
    }

    return { silentSessionIssueUrls };
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
}
