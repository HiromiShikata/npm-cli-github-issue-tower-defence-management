import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project, StoryOption } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';

export class ProjectNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

export type StoryObject = {
  story: StoryOption;
  storyIssue: Issue | null;
  issues: Issue[];
};
export type StoryObjectMap = Map<
  NonNullable<Project['story']>['stories'][0]['name'],
  StoryObject
>;

export class GetStoryObjectMapUseCase {
  constructor(
    readonly projectRepository: Pick<
      ProjectRepository,
      'findProjectIdByUrl' | 'getProject'
    >,
    readonly issueRepository: Pick<IssueRepository, 'getAllIssues'>,
  ) {}

  run = async (input: {
    projectUrl: string;
    allowIssueCacheMinutes: number;
  }): Promise<{
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    storyObjectMap: StoryObjectMap;
  }> => {
    const projectId = await this.projectRepository.findProjectIdByUrl(
      input.projectUrl,
    );
    if (!projectId) {
      throw new ProjectNotFoundError(
        `Project not found. projectUrl: ${input.projectUrl}`,
      );
    }
    const project = await this.projectRepository.getProject(projectId);
    if (!project) {
      throw new ProjectNotFoundError(
        `Project not found. projectId: ${projectId} projectUrl: ${input.projectUrl}`,
      );
    }
    const { issues, cacheUsed }: { issues: Issue[]; cacheUsed: boolean } =
      await this.issueRepository.getAllIssues(
        projectId,
        input.allowIssueCacheMinutes,
      );
    const storyObjectMap: StoryObjectMap = this.createStoryObjectMap({
      project,
      issues,
    });

    return { project, issues, cacheUsed, storyObjectMap };
  };

  createStoryObjectMap = (input: {
    project: Project;
    issues: Issue[];
  }): StoryObjectMap => {
    const summaryStoryIssue: StoryObjectMap = new Map();
    const targetStory = input.project.story?.stories || [];
    for (const story of targetStory) {
      const storyIssue = input.issues.find((issue) =>
        story.name.startsWith(issue.title),
      );
      summaryStoryIssue.set(story.name, {
        story,
        storyIssue: storyIssue || null,
        issues: [],
      });
      for (const issue of input.issues) {
        if (issue.story !== story.name) {
          continue;
        }
        summaryStoryIssue.get(story.name)?.issues.push(issue);
      }
    }
    return summaryStoryIssue;
  };
}
