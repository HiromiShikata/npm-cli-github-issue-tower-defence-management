import { IssueRepository } from './adapter-interfaces/IssueRepository';
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
      'getAllIssues' | 'updateStatus' | 'createComment'
    >,
    readonly localCommandRunner: LocalCommandRunner,
  ) {}

  run = async (params: {
    projectUrl: string;
    preparationStatus: string;
    awaitingWorkspaceStatus: string;
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

    for (const issue of preparationIssues) {
      const isOrphaned = await this.isOrphanedIssue(issue, params);
      if (isOrphaned) {
        await this.issueRepository.updateStatus(
          project,
          issue,
          awaitingWorkspaceStatusOption.id,
        );
        await this.issueRepository.createComment(
          issue,
          `Orphaned preparation detected: no live worker process found for ${issue.url}. Status reverted to ${params.awaitingWorkspaceStatus}.`,
        );
      }
    }
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
