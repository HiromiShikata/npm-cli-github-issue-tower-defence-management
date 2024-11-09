import { Issue, Label } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { GenerateWorkingTimeReportUseCase } from './GenerateWorkingTimeReportUseCase';
import { Member } from '../entities/Member';

export class ProjectNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

export class HandleScheduledEventUseCase {
  constructor(
    readonly generateWorkingTimeReportUseCase: GenerateWorkingTimeReportUseCase,
    readonly projectRepository: ProjectRepository,
    readonly issueRepository: IssueRepository,
  ) {}

  run = async (input: {
    targetDate: Date;
    project:
      | {
          projectId: Project['id'];
        }
      | {
          projectUrl: string;
        };
    org: string;
    manager: Member['name'];
    workingReport: {
      repo: string;
      members: Member['name'][];
      warningThresholdHour?: number;
      spreadsheetUrl: string;
      reportIssueTemplate?: string;
      reportIssueLabels: Label[];
    };
  }): Promise<void> => {
    const projectId = await this.findProjectId(input.project);
    const project = await this.projectRepository.getProject(projectId);
    if (!project) {
      throw new ProjectNotFoundError(
        `Project not found. projectId: ${projectId}`,
      );
    }
    const issues: Issue[] = await this.issueRepository.getAllIssues(projectId);
    const targetHour = input.targetDate.getHours();
    const targetMinute = input.targetDate.getMinutes();
    if (targetHour === 0 && targetMinute === 0) {
      await this.generateWorkingTimeReportUseCase.run({
        issues,
        ...input.workingReport,
        org: input.org,
        manager: input.manager,
      });
    }
  };
  findProjectId = async (
    input:
      | {
          projectId: Project['id'];
        }
      | {
          projectUrl: string;
        },
  ): Promise<Project['id']> => {
    if ('projectId' in input) {
      return input.projectId;
    }
    const projectId = await this.projectRepository.findProjectIdByUrl(
      input.projectUrl,
    );
    if (!projectId) {
      throw new ProjectNotFoundError(
        `Project not found. projectUrl: ${input.projectUrl}`,
      );
    }
    return projectId;
  };
}
