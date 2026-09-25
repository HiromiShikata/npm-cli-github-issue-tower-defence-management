import { Issue } from './Issue';
import { Project, StoryOption } from './Project';

export type StoryObject = {
  story: StoryOption;
  storyIssue: Issue | null;
  issues: Issue[];
};
export type StoryObjectMap = Map<
  NonNullable<Project['story']>['stories'][0]['id'],
  StoryObject
>;

export const buildStoryObjectMap = (input: {
  project: Project;
  issues: Issue[];
}): StoryObjectMap => {
  const storyObjectMap: StoryObjectMap = new Map();
  const stories = input.project.story?.stories ?? [];
  for (const story of stories) {
    const storyIssue = input.issues.find(
      (issue) => story.name.startsWith(issue.title) && !issue.isClosed,
    );
    storyObjectMap.set(story.id, {
      story,
      storyIssue: storyIssue ?? null,
      issues: input.issues.filter((issue) => issue.storyOptionId === story.id),
    });
  }
  return storyObjectMap;
};
