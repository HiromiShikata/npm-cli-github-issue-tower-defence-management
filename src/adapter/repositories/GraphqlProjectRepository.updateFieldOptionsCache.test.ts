const mockPost = jest.fn();
const mockUpdateFieldOptions = jest.fn<
  Promise<void>,
  [string, string, FieldOption[]]
>();

jest.mock('ky', () => ({
  default: {
    post: mockPost,
    get: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    extend: jest.fn(),
    create: jest.fn(),
    stop: jest.fn(),
  },
  __esModule: true,
}));

jest.mock('./ProjectIssuesCacheRepository', () => ({
  ProjectIssuesCacheRepository: jest.fn().mockImplementation(() => ({
    updateFieldOptions: mockUpdateFieldOptions,
  })),
}));

import { GraphqlProjectRepository } from './GraphqlProjectRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import {
  FieldOption,
  Project,
  StoryListEntry,
} from '../../domain/entities/Project';

const PROJECT_ID = 'test-project-id';
const GITHUB_RATE_LIMIT_MESSAGE = 'API rate limit already exceeded';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

const fieldOptions: FieldOption[] = [
  { id: 'option-1', name: 'Todo', color: 'BLUE', description: 'Not started' },
  { id: 'option-2', name: 'Done', color: 'GREEN', description: 'Finished' },
];

const successBody = {
  data: {
    updateProjectV2Field: {
      projectV2Field: {
        options: fieldOptions,
      },
    },
  },
};

const newOptionList: StoryListEntry[] = [
  { id: null, name: 'Todo', color: 'BLUE', description: 'Not started' },
];

const project: Project = {
  id: PROJECT_ID,
  url: 'https://github.com/orgs/example-org/projects/7',
  databaseId: 7,
  name: 'example-project',
  status: { name: 'Status', fieldId: 'PVTSSF_status', statuses: [] },
  nextActionDate: null,
  nextActionHour: {
    name: 'Next Action Hour',
    fieldId: 'PVTSSF_hour',
    options: [],
  },
  story: {
    name: 'Story',
    fieldId: 'PVTSSF_story',
    databaseId: 1,
    stories: [],
    workflowManagementStory: { id: 'story-id', name: 'Story' },
  },
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: { name: 'Agent', fieldId: 'PVTSSF_agent', options: [] },
};

type OptionListMethodCase = {
  methodName:
    | 'updateStoryList'
    | 'updateAgentList'
    | 'updateNextActionHourList'
    | 'updateStatusList';
  invoke: (repository: GraphqlProjectRepository) => Promise<FieldOption[]>;
  fieldId: string;
  updatesIssuesCache: boolean;
};

const optionListMethodCases: OptionListMethodCase[] = [
  {
    methodName: 'updateStoryList',
    invoke: (repository) => repository.updateStoryList(project, newOptionList),
    fieldId: 'PVTSSF_story',
    updatesIssuesCache: true,
  },
  {
    methodName: 'updateAgentList',
    invoke: (repository) => repository.updateAgentList(project, newOptionList),
    fieldId: 'PVTSSF_agent',
    updatesIssuesCache: false,
  },
  {
    methodName: 'updateNextActionHourList',
    invoke: (repository) =>
      repository.updateNextActionHourList(project, newOptionList),
    fieldId: 'PVTSSF_hour',
    updatesIssuesCache: false,
  },
  {
    methodName: 'updateStatusList',
    invoke: (repository) => repository.updateStatusList(project, newOptionList),
    fieldId: 'PVTSSF_status',
    updatesIssuesCache: true,
  },
];

const cacheUpdatingMethodCases = optionListMethodCases.filter(
  (method) => method.updatesIssuesCache,
);

const createRepository = (): GraphqlProjectRepository =>
  new GraphqlProjectRepository(new LocalStorageRepository(), 'dummy-token', {
    getLatest: jest.fn(),
    set: jest.fn(),
    getSingle: jest.fn(),
    setSingle: jest.fn(),
    withLock: jest.fn(),
  });

describe('GraphqlProjectRepository option list issues cache updates', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockUpdateFieldOptions.mockReset();
    mockUpdateFieldOptions.mockResolvedValue(undefined);
  });

  it.each(cacheUpdatingMethodCases)(
    '$methodName does not update the issues cache when the response has no data',
    async (method) => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          errors: [{ message: GITHUB_RATE_LIMIT_MESSAGE }],
        }),
      );

      await expect(method.invoke(createRepository())).rejects.toThrow(
        GITHUB_RATE_LIMIT_MESSAGE,
      );
      expect(mockUpdateFieldOptions).not.toHaveBeenCalled();
    },
  );

  it.each(optionListMethodCases)(
    '$methodName returns the options and updates the issues cache only for story and status lists',
    async (method) => {
      mockPost.mockReturnValueOnce(mockJsonResponse(successBody));

      const options = await method.invoke(createRepository());

      expect(options).toEqual(fieldOptions);
      expect(mockUpdateFieldOptions.mock.calls).toEqual(
        method.updatesIssuesCache
          ? [[PROJECT_ID, method.fieldId, fieldOptions]]
          : [],
      );
    },
  );
});
