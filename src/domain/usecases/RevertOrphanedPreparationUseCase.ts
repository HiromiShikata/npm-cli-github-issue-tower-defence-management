import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';

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
      const command = params.preparationProcessCheckCommand.replace(
        '{URL}',
        issue.url,
      );
      const { exitCode } = await this.localCommandRunner.runCommand(command);
      if (exitCode !== 0) {
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
}
