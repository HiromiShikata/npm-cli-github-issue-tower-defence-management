import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { FieldOption, Project } from '../entities/Project';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { Issue } from '../entities/Issue';

export class CreateNewStoryByLabelUseCase {
  constructor(
    readonly projectRepository: Pick<ProjectRepository, 'updateStoryList'>,
    readonly issueRepository: Pick<
      IssueRepository,
      'updateLabels' | 'updateStory'
    >,
  ) {}

  run = async (input: {
    project: Project;
    cacheUsed: boolean;
    org: string;
    repo: string;
    storyObjectMap: StoryObjectMap;
    issues: Issue[];
  }): Promise<void> => {
    const projectStory = input.project.story;
    if (!projectStory) {
      return;
    }
    const newStoryIssues = this.findNewStoryIssues(
      input.storyObjectMap,
      input.issues,
    );
    if (newStoryIssues.length === 0) {
      return;
    }
    const newStoryList = this.createNewStoryList(
      projectStory,
      input.storyObjectMap,
      input.issues,
    );
    const savedNewStoryList = await this.projectRepository.updateStoryList(
      input.project,
      newStoryList,
    );

    for (const issue of newStoryIssues) {
      const linkedStory = savedNewStoryList.find((s) => s.name === issue.title);
      if (!linkedStory) {
        continue;
      }
      await this.issueRepository.updateStory(
        { ...input.project, story: projectStory },
        issue,
        linkedStory.id,
      );
      await this.issueRepository.updateLabels(
        issue,
        issue.labels.filter(
          (label) => label.toLowerCase().replace('-', '') !== 'newstory',
        ),
      );
    }
  };

  hasNewStoryLabel = (issue: Issue): boolean =>
    issue.labels?.some(
      (label) => label.toLowerCase().replace('-', '') === 'newstory',
    ) ?? false;

  findNewStoryIssues = (
    storyObjectMap: StoryObjectMap,
    issues: Issue[],
  ): Issue[] => {
    const issuesInMap = Array.from(storyObjectMap.values())
      .flatMap((storyObject) => storyObject.issues)
      .filter(this.hasNewStoryLabel);
    const unassignedIssuesWithLabel = issues
      .filter((issue) => issue.story === null)
      .filter(this.hasNewStoryLabel);
    const seen = new Set<string>();
    return [...issuesInMap, ...unassignedIssuesWithLabel].filter((issue) => {
      if (seen.has(issue.url)) {
        return false;
      }
      seen.add(issue.url);
      return true;
    });
  };

  createNewStoryList = (
    projectStory: NonNullable<Project['story']>,
    storyObjectMap: StoryObjectMap,
    issues: Issue[],
  ): (Omit<FieldOption, 'id'> & { id: FieldOption['id'] | null })[] => {
    const newStoryIssues = this.findNewStoryIssues(storyObjectMap, issues);
    const newStoryList: (Omit<FieldOption, 'id'> & {
      id: FieldOption['id'] | null;
    })[] = [];
    if (projectStory.stories.length > 0) {
      newStoryList.push(projectStory.stories[0]);
    }
    newStoryList.push(
      ...newStoryIssues.map(
        (i): Omit<FieldOption, 'id'> & { id: FieldOption['id'] | null } => ({
          id: null,
          name: i.title,
          color: 'RED',
          description: '',
        }),
      ),
    );
    if (projectStory.stories.length > 1) {
      newStoryList.push(
        ...projectStory.stories.slice(1, projectStory.stories.length),
      );
    }
    return newStoryList;
  };
}
