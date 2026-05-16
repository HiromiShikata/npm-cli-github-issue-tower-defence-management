import {
  IssueRepository,
  RelatedPullRequest,
} from './adapter-interfaces/IssueRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { Issue } from '../entities/Issue';

export class RevertOrphanedPreparationUseCase {
  constructor(
    readonly projectRepository: Pick<
      ProjectRepository,
      'findProjectIdByUrl' | 'getProject'
    >,
    readonly issueRepository: Pick<
      IssueRepository,
      | 'getAllIssues'
      | 'updateStatus'
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
    >,
    readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue'
    >,
    readonly localCommandRunner: LocalCommandRunner,
  ) {}

  run = async (params: {
    projectUrl: string;
    preparationStatus: string;
    awaitingWorkspaceStatus: string;
    awaitingQualityCheckStatus?: string;
    allowIssueCacheMinutes: number;
    preparationProcessCheckCommand: string;
    awLogDirectoryPath?: string;
    awLogStaleThresholdMinutes?: number;
  }): Promise<void> => {
    const projectId = await this.projectRepository.findProjectIdByUrl(
      params.projectUrl,
    );
    if (!projectId) {
      throw new Error(`Project not found. projectUrl: ${params.projectUrl}`);
    }
    const project = await this.projectRepository.getProject(projectId);
    if (!project) {
      throw new Error(
        `Project not found. projectId: ${projectId} projectUrl: ${params.projectUrl}`,
      );
    }
    const { issues } = await this.issueRepository.getAllIssues(
      projectId,
      params.allowIssueCacheMinutes,
    );

    const preparationIssues = issues.filter(
      (issue) => issue.status === params.preparationStatus,
    );

    const awaitingWorkspaceStatusOption = project.status.statuses.find(
      (s) => s.name === params.awaitingWorkspaceStatus,
    );
    if (!awaitingWorkspaceStatusOption) {
      return;
    }

    const awaitingQualityCheckStatusOption = params.awaitingQualityCheckStatus
      ? project.status.statuses.find(
          (s) => s.name === params.awaitingQualityCheckStatus,
        )
      : null;

    for (const issue of preparationIssues) {
      const isOrphaned = await this.isOrphanedIssue(issue, params);
      if (isOrphaned) {
        const hasRejections = await this.evaluateHasRejections(issue);
        if (!hasRejections && awaitingQualityCheckStatusOption) {
          await this.issueRepository.updateStatus(
            project,
            issue,
            awaitingQualityCheckStatusOption.id,
          );
        } else {
          await this.issueRepository.updateStatus(
            project,
            issue,
            awaitingWorkspaceStatusOption.id,
          );
        }
      }
    }
  };

  private evaluateHasRejections = async (issue: Issue): Promise<boolean> => {
    const comments =
      await this.issueCommentRepository.getCommentsFromIssue(issue);
    const lastComment = comments[comments.length - 1];
    if (!lastComment || !lastComment.content.startsWith('From:')) {
      return true;
    }
    if (this.reportBodyHasNextStep(lastComment.content)) {
      return true;
    }

    const categoryLabels = issue.labels.filter((label) =>
      label.startsWith('category:'),
    );
    const hasLlmAgentLabel = issue.labels.some(
      (l) => l === 'llm-agent' || l.startsWith('llm-agent:'),
    );
    if (
      hasLlmAgentLabel ||
      (categoryLabels.length > 0 && !categoryLabels.includes('category:e2e'))
    ) {
      return false;
    }

    const prsToCheck = issue.isPr
      ? await this.resolveOpenPrsForPrItem(issue.url)
      : await this.issueRepository.findRelatedOpenPRs(issue.url);

    if (prsToCheck.length !== 1) {
      return true;
    }

    const pr = prsToCheck[0];
    return (
      pr.isConflicted || !pr.isPassedAllCiJob || !pr.isResolvedAllReviewComments
    );
  };

  private resolveOpenPrsForPrItem = async (
    prUrl: string,
  ): Promise<RelatedPullRequest[]> => {
    const pr = await this.issueRepository.getOpenPullRequest(prUrl);
    if (pr === null) {
      return [];
    }
    return [pr];
  };

  private reportBodyHasNextStep = (body: string): boolean => {
    const reportMatch = body.match(/```json\n([\s\S]*?)\n```/);
    if (!reportMatch || reportMatch.length < 2) {
      return false;
    }
    let reportJson: unknown;
    try {
      reportJson = JSON.parse(reportMatch[1]);
    } catch (error) {
      console.warn(
        'Invalid JSON in report body while checking nextStep:',
        error,
      );
      return false;
    }
    if (typeof reportJson !== 'object' || reportJson === null) {
      return false;
    }
    if (!('nextStep' in reportJson)) {
      return false;
    }
    const nextStepValue = Reflect.get(reportJson, 'nextStep');
    return nextStepValue !== null && nextStepValue !== undefined;
  };

  private isOrphanedIssue = async (
    issue: Issue,
    params: {
      preparationProcessCheckCommand: string;
      awLogDirectoryPath?: string;
      awLogStaleThresholdMinutes?: number;
    },
  ): Promise<boolean> => {
    const commandTemplate = params.preparationProcessCheckCommand.replace(
      '{URL}',
      '$1',
    );
    const { exitCode } = await this.localCommandRunner.runCommand('sh', [
      '-c',
      commandTemplate,
      '--',
      issue.url,
    ]);

    if (exitCode !== 0) return true;

    const { awLogDirectoryPath, awLogStaleThresholdMinutes } = params;
    if (!awLogDirectoryPath || !awLogStaleThresholdMinutes) return false;

    return this.isAwLogStale(
      issue,
      awLogDirectoryPath,
      awLogStaleThresholdMinutes,
    );
  };

  private isAwLogStale = async (
    issue: Issue,
    awLogDirectoryPath: string,
    awLogStaleThresholdMinutes: number,
  ): Promise<boolean> => {
    const logPattern = `${issue.org}_${issue.repo}_${issue.number}_*`;

    const { stdout: anyFilesOutput, exitCode: anyFilesExitCode } =
      await this.localCommandRunner.runCommand('sh', [
        '-c',
        'find "$1" -name "$2"',
        '--',
        awLogDirectoryPath,
        logPattern,
      ]);

    if (anyFilesExitCode !== 0 || !anyFilesOutput.trim()) return false;

    const { stdout: recentFilesOutput, exitCode: recentFilesExitCode } =
      await this.localCommandRunner.runCommand('sh', [
        '-c',
        'find "$1" -name "$2" -mmin -$3',
        '--',
        awLogDirectoryPath,
        logPattern,
        String(awLogStaleThresholdMinutes),
      ]);

    if (recentFilesExitCode !== 0) return false;

    return !recentFilesOutput.trim();
  };
}
