import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';

export class UpdateIssueStatusByLabelUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      'updateStatus' | 'removeLabel' | 'getRecentLabelEventActor'
    >,
  ) {}

  static readonly STATUS_LABEL_PREFIX = 'status:';

  static normalizeStatus = (status: string): string =>
    status.toLowerCase().replace(/[\s\-_]/g, '');

  private removeLabelOrThrow = async (
    issue: Issue,
    labelName: string,
  ): Promise<void> => {
    try {
      await this.issueRepository.removeLabel(issue, labelName);
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }
      throw new Error(
        `Failed to remove label ${labelName} from issue ${issue.url}: ${e.message}`,
        { cause: e },
      );
    }
  };

  run = async (input: {
    project: Project;
    issues: Issue[];
    allowedLabelActors: string[] | null;
  }): Promise<void> => {
    for (const issue of input.issues) {
      const statusLabel = issue.labels.find((label) =>
        label
          .toLowerCase()
          .startsWith(UpdateIssueStatusByLabelUseCase.STATUS_LABEL_PREFIX),
      );
      if (!statusLabel) {
        continue;
      }
      const targetStatusName = statusLabel.slice(
        UpdateIssueStatusByLabelUseCase.STATUS_LABEL_PREFIX.length,
      );
      const targetStatus = input.project.status.statuses.find(
        (s) =>
          UpdateIssueStatusByLabelUseCase.normalizeStatus(s.name) ===
          UpdateIssueStatusByLabelUseCase.normalizeStatus(targetStatusName),
      );
      if (!targetStatus) {
        continue;
      }
      if (input.allowedLabelActors !== null) {
        const actor = await this.issueRepository.getRecentLabelEventActor(
          issue,
          statusLabel,
        );
        if (actor === null || !input.allowedLabelActors.includes(actor)) {
          await this.removeLabelOrThrow(issue, statusLabel);
          continue;
        }
      }
      const currentStatusNormalized = issue.status
        ? UpdateIssueStatusByLabelUseCase.normalizeStatus(issue.status)
        : null;
      const targetStatusNormalized =
        UpdateIssueStatusByLabelUseCase.normalizeStatus(targetStatus.name);
      if (currentStatusNormalized !== targetStatusNormalized) {
        await this.issueRepository.updateStatus(
          input.project,
          issue,
          targetStatus.id,
        );
      }
      await this.removeLabelOrThrow(issue, statusLabel);
    }
  };
}
