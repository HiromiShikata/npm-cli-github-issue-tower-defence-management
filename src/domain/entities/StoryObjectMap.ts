import { Issue } from './Issue';
import { Project, StoryOption } from './Project';

export type StoryObject = {
  story: StoryOption;
  storyIssue: Issue | null;
  issues: Issue[];
};
export type StoryObjectMap = Map<
  NonNullable<Project['story']>['stories'][0]['name'],
  StoryObject
>;
