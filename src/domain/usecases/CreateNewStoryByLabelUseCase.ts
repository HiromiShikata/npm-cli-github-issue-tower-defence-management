import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { FieldOption, Project } from '../entities/Project';
import { StoryObjectMap } from './HandleScheduledEventUseCase';
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
    disabledStatus: string;
    storyObjectMap: StoryObjectMap;
  }): Promise<void> => {
    const projectStory = input.project.story;
    if (!projectStory) {
      return;
    }
    const newStoryIssues = this.findNewStoryIssues(input.storyObjectMap);
    if (newStoryIssues.length === 0) {
      return;
    }
    const newStoryList = this.createNewStoryList(
      projectStory,
      input.storyObjectMap,
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
  findNewStoryIssues = (storyObjectMap: StoryObjectMap): Issue[] => {
    return Array.from(storyObjectMap.values())
      .flatMap((storyObject) => storyObject.issues)
      .filter((issue) =>
        issue.labels?.some(
          (label) => label.toLowerCase().replace('-', '') === 'newstory',
        ),
      );
  };
  createNewStoryList = (
    projectStory: NonNullable<Project['story']>,
    storyObjectMap: StoryObjectMap,
  ): (Omit<FieldOption, 'id'> & { id: FieldOption['id'] | null })[] => {
    const newStoryIssues = Array.from(storyObjectMap.values())
      .flatMap((storyObject) => storyObject.issues)
      .filter((issue) =>
        issue.labels?.some(
          (label) => label.toLowerCase().replace('-', '') === 'newstory',
        ),
      );
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
        ...projectStory.stories.slice(1, projectStory.stories.length - 1),
      );
    }
    return newStoryList;
  };
}
