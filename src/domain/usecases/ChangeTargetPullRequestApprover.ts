import { IssueRepository } from './adapter-interfaces/IssueRepository';

export class ChangeTargetPullRequestApprover {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      'getPullRequestChangedFilePaths' | 'approvePullRequest'
    >,
  ) {}

  approveIfConfined = async (
    issueLabels: string[],
    approvedPrUrl: string | null,
  ): Promise<void> => {
    if (approvedPrUrl === null) {
      return;
    }
    const changeTargetPaths = this.extractChangeTargetPaths(issueLabels);
    if (changeTargetPaths.length === 0) {
      return;
    }
    const changedFilePaths =
      await this.issueRepository.getPullRequestChangedFilePaths(approvedPrUrl);
    if (changedFilePaths.length === 0) {
      return;
    }
    const allConfined = changedFilePaths.every((filePath) =>
      this.isFilePathConfinedToAllowedPaths(filePath, changeTargetPaths),
    );
    if (!allConfined) {
      return;
    }
    await this.issueRepository.approvePullRequest(approvedPrUrl);
  };

  private extractChangeTargetPaths = (labels: string[]): string[] => {
    const prefix = 'change-target:';
    const paths: string[] = [];
    for (const label of labels) {
      if (!label.startsWith(prefix)) continue;
      const raw = label.slice(prefix.length).trim();
      if (raw.length === 0) continue;
      const normalized = raw.replace(/\/+$/, '');
      if (normalized.length === 0) continue;
      paths.push(normalized);
    }
    return paths;
  };

  private isFilePathConfinedToAllowedPaths = (
    filePath: string,
    allowedPaths: string[],
  ): boolean =>
    allowedPaths.some(
      (allowedPath) =>
        filePath === allowedPath || filePath.startsWith(`${allowedPath}/`),
    );
}
