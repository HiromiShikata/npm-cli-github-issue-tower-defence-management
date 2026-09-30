import { Project, StoryListEntry } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';

export const ensureStoryOptionAndGetId = async (
  projectRepository: Pick<ProjectRepository, 'updateStoryList'>,
  project: Project,
  storyName: string,
): Promise<string | null> => {
  if (project.story === null) {
    return null;
  }
  const existing = project.story.stories.find(
    (story) => story.name === storyName,
  );
  if (existing) {
    return existing.id;
  }
  const mergedStories: StoryListEntry[] = [
    ...project.story.stories,
    { id: null, name: storyName, color: 'RED', description: '' },
  ];
  const updatedStories = await projectRepository.updateStoryList(
    project,
    mergedStories,
  );
  const created = updatedStories.find((story) => story.name === storyName);
  return created?.id ?? null;
};
