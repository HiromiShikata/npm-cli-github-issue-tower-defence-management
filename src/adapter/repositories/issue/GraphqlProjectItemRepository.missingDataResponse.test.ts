const mockPost = jest.fn();

jest.mock('ky', () => {
  const actualKy: typeof import('ky') = jest.requireActual('ky');
  return {
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
    HTTPError: actualKy.HTTPError,
    __esModule: true,
  };
});

import { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

const PROJECT_ID = 'test-project-id';
const ISSUE_URL = 'https://github.com/example-owner/example-repo/issues/1';
const GITHUB_RATE_LIMIT_MESSAGE = 'API rate limit already exceeded';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

const contentIdResponse = {
  data: {
    repository: {
      issueOrPullRequest: { id: 'content-id' },
    },
  },
};

type MissingDataCase = {
  label: string;
  responseBodies: unknown[];
  call: (repository: GraphqlProjectItemRepository) => Promise<unknown>;
  expectedFragments: string[];
};

const missingDataCases: MissingDataCase[] = [
  {
    label: 'updateProjectField with an errors-only body',
    responseBodies: [{ errors: [{ message: GITHUB_RATE_LIMIT_MESSAGE }] }],
    call: (repository) =>
      repository.updateProjectField(PROJECT_ID, 'field-id', 'item-id', {
        text: 'value',
      }),
    expectedFragments: ['updateProjectField', GITHUB_RATE_LIMIT_MESSAGE],
  },
  {
    label: 'updateProjectField with an empty body',
    responseBodies: [{}],
    call: (repository) =>
      repository.updateProjectField(PROJECT_ID, 'field-id', 'item-id', {
        text: 'value',
      }),
    expectedFragments: ['updateProjectField'],
  },
  {
    label: 'addIssueToProject with an empty body on the content lookup',
    responseBodies: [{}],
    call: (repository) => repository.addIssueToProject(PROJECT_ID, ISSUE_URL),
    expectedFragments: ['addIssueToProject'],
  },
  {
    label: 'addIssueToProject with an empty body on the add mutation',
    responseBodies: [contentIdResponse, {}],
    call: (repository) => repository.addIssueToProject(PROJECT_ID, ISSUE_URL),
    expectedFragments: ['addIssueToProject'],
  },
];

type MissingDataOutcome = {
  label: string;
  errorName: string;
  missingFragments: string[];
};

const captureMissingDataOutcome = async (
  label: string,
  call: Promise<unknown>,
  expectedFragments: string[],
): Promise<MissingDataOutcome> => {
  try {
    await call;
    return {
      label,
      errorName: 'resolved',
      missingFragments: expectedFragments,
    };
  } catch (error) {
    if (!(error instanceof Error)) {
      return {
        label,
        errorName: 'not an Error',
        missingFragments: expectedFragments,
      };
    }
    return {
      label,
      errorName: error.name,
      missingFragments: expectedFragments.filter(
        (fragment) => !error.message.includes(fragment),
      ),
    };
  }
};

describe('GraphqlProjectItemRepository mutations with missing data in the response', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('rejects with a plain Error naming the method when the response has no data', async () => {
    const outcomes: MissingDataOutcome[] = [];
    for (const testCase of missingDataCases) {
      mockPost.mockReset();
      for (const responseBody of testCase.responseBodies) {
        mockPost.mockReturnValueOnce(mockJsonResponse(responseBody));
      }
      outcomes.push(
        await captureMissingDataOutcome(
          testCase.label,
          testCase.call(
            new GraphqlProjectItemRepository(
              new LocalStorageRepository(),
              'dummy-token',
            ),
          ),
          testCase.expectedFragments,
        ),
      );
    }

    expect(outcomes).toEqual(
      missingDataCases.map((testCase) => ({
        label: testCase.label,
        errorName: 'Error',
        missingFragments: [],
      })),
    );
  });
});
