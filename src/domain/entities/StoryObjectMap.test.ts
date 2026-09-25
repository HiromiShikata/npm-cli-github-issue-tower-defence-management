import { buildStoryObjectMap } from './StoryObjectMap';
import { Issue } from './Issue';
import { Project } from './Project';

const basicStoryField: NonNullable<Project['story']> = {
  name: 'Story',
  fieldId: 'story-field-1',
  databaseId: 1,
  stories: [
    {
      id: 'story-1',
      name: 'Story A: implement feature',
      color: 'BLUE',
      description: 'Desc',
    },
    {
      id: 'story-2',
      name: 'Story B: fix bug',
      color: 'GREEN',
      description: 'Desc',
    },
  ],
  workflowManagementStory: {
    id: 'wf-story',
    name: 'Workflow',
  },
};

const basicProject: Project = {
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-1',
    statuses: [],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: basicStoryField,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
};

const duplicateDisplayNameProject: Project = {
  ...basicProject,
  story: {
    ...basicStoryField,
    stories: [
      {
        id: 'story-dup-closed',
        name: 'testing base',
        color: 'GRAY',
        description:
          'Duplicate option created by a project-sync replication delay, later closed/disabled',
      },
      {
        id: 'story-dup-open',
        name: 'testing base',
        color: 'BLUE',
        description: 'Active option that stays open',
      },
    ],
  },
};

const createBasicIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'org/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/org/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'org',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date(),
  author: '',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

describe('buildStoryObjectMap', () => {
  it('creates one map entry per story option instance, keyed by id, when two options share the same display name', () => {
    const result = buildStoryObjectMap({
      project: duplicateDisplayNameProject,
      issues: [],
    });

    expect(result.size).toBe(2);
    expect(result.get('story-dup-closed')?.story.id).toBe('story-dup-closed');
    expect(result.get('story-dup-open')?.story.id).toBe('story-dup-open');
  });

  const storyIssueResolutionCases: {
    name: string;
    matchingIssueIsClosed: boolean;
    expectStoryIssueSelected: boolean;
  }[] = [
    {
      name: 'excludes a closed issue whose title is a prefix-match of the option name from storyIssue',
      matchingIssueIsClosed: true,
      expectStoryIssueSelected: false,
    },
    {
      name: 'selects an open issue whose title is a prefix-match of the option name as storyIssue',
      matchingIssueIsClosed: false,
      expectStoryIssueSelected: true,
    },
  ];
  it.each(storyIssueResolutionCases)(
    '$name',
    ({ matchingIssueIsClosed, expectStoryIssueSelected }) => {
      const matchingIssue = createBasicIssue({
        number: 1,
        title: 'Story A',
        isClosed: matchingIssueIsClosed,
      });

      const result = buildStoryObjectMap({
        project: basicProject,
        issues: [matchingIssue],
      });

      const storyAObject = result.get('story-1');
      expect(storyAObject?.storyIssue).toEqual(
        expectStoryIssueSelected ? matchingIssue : null,
      );
    },
  );

  const issueGroupingByStoryOptionIdCases: {
    name: string;
    storyOptionId: string | null | undefined;
    story: string | null;
    expectedStory1Issues: boolean;
    expectedStory2Issues: boolean;
  }[] = [
    {
      name: 'attaches an issue to the option whose id matches storyOptionId, even when the display-name story field points to a different option',
      storyOptionId: 'story-1',
      story: 'Story B: fix bug',
      expectedStory1Issues: true,
      expectedStory2Issues: false,
    },
    {
      name: 'does not attach an issue with an undefined storyOptionId to any option',
      storyOptionId: undefined,
      story: 'Story A: implement feature',
      expectedStory1Issues: false,
      expectedStory2Issues: false,
    },
    {
      name: 'does not attach an issue with a null storyOptionId to any option',
      storyOptionId: null,
      story: 'Story A: implement feature',
      expectedStory1Issues: false,
      expectedStory2Issues: false,
    },
  ];
  it.each(issueGroupingByStoryOptionIdCases)(
    '$name',
    ({ storyOptionId, story, expectedStory1Issues, expectedStory2Issues }) => {
      const issue = createBasicIssue({
        number: 1,
        title: 'Some issue',
        story,
        storyOptionId,
      });

      const result = buildStoryObjectMap({
        project: basicProject,
        issues: [issue],
      });

      expect(result.get('story-1')?.issues).toEqual(
        expectedStory1Issues ? [issue] : [],
      );
      expect(result.get('story-2')?.issues).toEqual(
        expectedStory2Issues ? [issue] : [],
      );
    },
  );

  it('attaches an issue to the correct option instance by id, not by display name, when two options share the same name', () => {
    const issue = createBasicIssue({
      number: 1,
      title: 'Some issue',
      story: 'testing base',
      storyOptionId: 'story-dup-open',
    });

    const result = buildStoryObjectMap({
      project: duplicateDisplayNameProject,
      issues: [issue],
    });

    expect(result.get('story-dup-open')?.issues).toEqual([issue]);
    expect(result.get('story-dup-closed')?.issues).toEqual([]);
  });
});
