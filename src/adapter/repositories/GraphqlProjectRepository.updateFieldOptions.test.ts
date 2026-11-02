const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('ky', () => ({
  default: {
    post: mockPost,
    get: mockGet,
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    extend: jest.fn(),
    create: jest.fn(),
    stop: jest.fn(),
  },
  __esModule: true,
}));

import { GraphqlProjectRepository } from './GraphqlProjectRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { Project } from '../../domain/entities/Project';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

const project: Project = {
  id: 'test-project-id',
  url: 'https://github.com/orgs/X-Mile/projects/7',
  databaseId: 7,
  name: 'X-Mile',
  status: {
    name: 'Status',
    fieldId: 'PVTSSF_status',
    statuses: [],
  },
  nextActionDate: null,
  nextActionHour: {
    name: 'NextActionHour',
    fieldId: 'PVTSSF_hour',
    options: [],
  },
  story: {
    name: 'Story',
    fieldId: 'PVTSSF_story',
    databaseId: 1,
    stories: [],
    workflowManagementStory: { id: 'story-id', name: 'workflow' },
  },
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: {
    name: 'Agent',
    fieldId: 'PVTSSF_agent',
    options: [],
  },
};

const newOptions = [
  { id: null, name: 'A', color: 'RED' as const, description: '' },
];

type UpdateCall = (repository: GraphqlProjectRepository) => Promise<unknown>;

const updateMethods: { method: string; call: UpdateCall }[] = [
  {
    method: 'updateStoryList',
    call: (repository) => repository.updateStoryList(project, newOptions),
  },
  {
    method: 'updateAgentList',
    call: (repository) => repository.updateAgentList(project, newOptions),
  },
  {
    method: 'updateNextActionHourList',
    call: (repository) =>
      repository.updateNextActionHourList(project, newOptions),
  },
  {
    method: 'updateStatusList',
    call: (repository) => repository.updateStatusList(project, newOptions),
  },
];

describe('GraphqlProjectRepository field option updates without data', () => {
  let repository: GraphqlProjectRepository;

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    repository = new GraphqlProjectRepository(
      new LocalStorageRepository(),
      'dummy-token',
    );
  });

  it.each(updateMethods)(
    'should throw the GitHub error message when $method receives errors without data',
    async ({ method, call }) => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          errors: [
            { message: 'API rate limit already exceeded for user ID 1.' },
          ],
        }),
      );

      await expect(call(repository)).rejects.toThrow(
        `GitHub GraphQL API returned no data for ${method}: API rate limit already exceeded for user ID 1.`,
      );
    },
  );

  it.each(updateMethods)(
    'should throw a descriptive error when $method receives neither errors nor data',
    async ({ method, call }) => {
      mockPost.mockReturnValueOnce(mockJsonResponse({}));

      await expect(call(repository)).rejects.toThrow(
        `GitHub GraphQL API returned no data for ${method}: no data field in response`,
      );
    },
  );
});
