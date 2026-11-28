type MockJsonResponse = ReturnType<typeof mockJsonResponse>;

const mockGet = jest.fn<MockJsonResponse, [string, RequestInit | undefined]>();

jest.mock('ky', () => ({
  default: {
    get: mockGet,
  },
  __esModule: true,
}));

import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

const mockJsonResponse = (data: unknown) => ({
  json: jest.fn().mockResolvedValue(data),
});

describe('ApiV3IssueRepository.searchIssue', () => {
  const repository = new ApiV3IssueRepository(
    new LocalStorageRepository(),
    'dummy-token',
  );

  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockReturnValue(
      mockJsonResponse({
        total_count: 0,
        items: [],
      }),
    );
  });

  test.each([
    'plain title',
    'Fix A&B',
    'C# issue',
    'a+b',
    'with space and 日本語 text',
  ])('encodes title query value: %s', async (title) => {
    await repository.searchIssue({
      owner: 'some-owner',
      repositoryName: 'some-repo',
      type: 'issue',
      title,
      assignee: 'some-user',
    });

    const requestUrl = mockGet.mock.calls[0][0];
    const url = new URL(requestUrl);
    const q = url.searchParams.get('q');
    const titleQualifier = q?.match(/in:title '([^']+)'/)?.[1];

    expect(titleQualifier).toBe(title);
    expect(url.searchParams.get('assignee')).toBe('some-user');
    expect(q).toContain('type:issue');
    expect(q).toContain('repo:some-owner/some-repo');
  });
});
