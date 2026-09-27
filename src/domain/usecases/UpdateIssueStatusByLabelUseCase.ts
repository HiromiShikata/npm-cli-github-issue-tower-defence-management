import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { StaleProjectItemError } from './SetupTowerDefenceProjectUseCase';

export class UpdateIssueStatusByLabelUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      'updateStatus' | 'removeLabel'
    >,
  ) {}

  static readonly STATUS_LABEL_PREFIX = 'status:';

  static normalizeStatus = (status: string): string =>
    status.toLowerCase().replace(/[\s\-_]/g, '');

  run = async (input: { project: Project; issues: Issue[] }): Promise<void> => {
    const failedIssueDescriptions: string[] = [];
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
      const currentStatusNormalized = issue.status
        ? UpdateIssueStatusByLabelUseCase.normalizeStatus(issue.status)
        : null;
      const targetStatusNormalized =
        UpdateIssueStatusByLabelUseCase.normalizeStatus(targetStatus.name);
      if (currentStatusNormalized !== targetStatusNormalized) {
        try {
          await this.issueRepository.updateStatus(
            input.project,
            issue,
            targetStatus.id,
          );
        } catch (error) {
          if (error instanceof StaleProjectItemError) {
            console.warn(
              `Skipping stale project item while updating status by label: ${issue.url} (itemId=${error.itemId})`,
            );
            continue;
          }
          failedIssueDescriptions.push(
            `${issue.url}: ${error instanceof Error ? error.message : String(error)}`,
          );
          continue;
        }
      }
      try {
        await this.issueRepository.removeLabel(issue, statusLabel);
      } catch (error) {
        failedIssueDescriptions.push(
          `${issue.url}: Failed to remove label ${statusLabel}: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
    }
    if (failedIssueDescriptions.length > 0) {
      throw new Error(
        `Failed to update issue status by label for ${failedIssueDescriptions.length} issue(s): ${failedIssueDescriptions.join('; ')}`,
      );
    }
  };
}
