import { ensureStoryOptionAndGetId } from './ensureStoryOptionAndGetId';
import { FieldOption, Project, StoryListEntry } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';

const createMockProject = (stories: FieldOption[]): Project => ({
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-id',
    statuses: [],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: {
    name: 'Story',
    fieldId: 'story-field-id',
    databaseId: 1,
    stories,
    workflowManagementStory: {
      id: 'wms-id',
      name: 'workflow management',
    },
  },
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
});

const EXISTING_TWO: FieldOption[] = [
  {
    id: 'story-opt-wf',
    name: 'regular / workflow improvement',
    color: 'BLUE',
    description: '',
  },
  {
    id: 'story-opt-other',
    name: 'regular / other',
    color: 'GREEN',
    description: '',
  },
];

type TestCase = {
  name: string;
  existingStories: FieldOption[];
  storyName: string;
  updateStoryListCalled: boolean;
  updateStoryListReturnValue: FieldOption[];
  expectedUpdateStoryListArg: StoryListEntry[] | null;
  expectedReturn: string | null;
};

const testCases: TestCase[] = [
  {
    name: 'returns the matching existing option id without calling updateStoryList when storyName matches an existing option',
    existingStories: EXISTING_TWO,
    storyName: 'regular / workflow improvement',
    updateStoryListCalled: false,
    updateStoryListReturnValue: [],
    expectedUpdateStoryListArg: null,
    expectedReturn: 'story-opt-wf',
  },
  {
    name: 'calls updateStoryList with the existing options plus the new RED entry and returns the created id when storyName has no match',
    existingStories: EXISTING_TWO,
    storyName: 'regular / new story',
    updateStoryListCalled: true,
    updateStoryListReturnValue: [
      ...EXISTING_TWO,
      {
        id: 'story-opt-new',
        name: 'regular / new story',
        color: 'RED',
        description: '',
      },
    ],
    expectedUpdateStoryListArg: [
      ...EXISTING_TWO,
      { id: null, name: 'regular / new story', color: 'RED', description: '' },
    ],
    expectedReturn: 'story-opt-new',
  },
  {
    name: 'calls updateStoryList with a single new entry and returns its id when project.story.stories starts empty',
    existingStories: [],
    storyName: 'first story',
    updateStoryListCalled: true,
    updateStoryListReturnValue: [
      {
        id: 'story-opt-first',
        name: 'first story',
        color: 'RED',
        description: '',
      },
    ],
    expectedUpdateStoryListArg: [
      { id: null, name: 'first story', color: 'RED', description: '' },
    ],
    expectedReturn: 'story-opt-first',
  },
  {
    name: 'returns null when updateStoryList is called but its returned list does not contain an entry named after storyName',
    existingStories: [
      {
        id: 'story-opt-other',
        name: 'regular / other',
        color: 'GREEN',
        description: '',
      },
    ],
    storyName: 'regular / new story',
    updateStoryListCalled: true,
    updateStoryListReturnValue: [
      {
        id: 'story-opt-other',
        name: 'regular / other',
        color: 'GREEN',
        description: '',
      },
    ],
    expectedUpdateStoryListArg: [
      {
        id: 'story-opt-other',
        name: 'regular / other',
        color: 'GREEN',
        description: '',
      },
      { id: null, name: 'regular / new story', color: 'RED', description: '' },
    ],
    expectedReturn: null,
  },
];

describe('ensureStoryOptionAndGetId', () => {
  it.each(testCases)('$name', async (testCase) => {
    const project = createMockProject(testCase.existingStories);
    const updateStoryList = jest
      .fn()
      .mockResolvedValue(testCase.updateStoryListReturnValue);
    const mockProjectRepository: Pick<ProjectRepository, 'updateStoryList'> = {
      updateStoryList,
    };

    const result = await ensureStoryOptionAndGetId(
      mockProjectRepository,
      project,
      testCase.storyName,
    );

    expect(result).toBe(testCase.expectedReturn);
    if (testCase.updateStoryListCalled) {
      expect(updateStoryList).toHaveBeenCalledTimes(1);
      expect(updateStoryList).toHaveBeenCalledWith(
        project,
        testCase.expectedUpdateStoryListArg,
      );
    } else {
      expect(updateStoryList).not.toHaveBeenCalled();
    }
  });
});
