import { GithubIssueReference } from '../../domain/usecases/adapter-interfaces/StoryGateIssueRepository';
import { GithubStoryGateIssueRepository } from './GithubStoryGateIssueRepository';

const ISSUE_A: GithubIssueReference = {
  owner: 'org-a',
  repo: 'repo-a',
  number: 1,
  url: 'https://github.com/org-a/repo-a/issues/1',
};
const ISSUE_B: GithubIssueReference = {
  owner: 'org-b',
  repo: 'repo-b',
  number: 2,
  url: 'https://github.com/org-b/repo-b/issues/2',
};

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const issueResponse = (): Response =>
  jsonResponse({ state: 'open', body: '', labels: [] });

const noWait = jest.fn(async (_milliseconds: number): Promise<void> => {});

const tokenFunctionCreate = (): {
  tokenFunction: (itemUrl: string) => string;
  calls: string[];
} => {
  const calls: string[] = [];
  const tokenFunction = (itemUrl: string): string => {
    calls.push(itemUrl);
    if (itemUrl.startsWith('https://github.com/org-a/')) {
      return 'token-a';
    }
    if (itemUrl.startsWith('https://github.com/org-b/')) {
      return 'token-b';
    }
    throw new Error(`unexpected item url: ${itemUrl}`);
  };
  return { tokenFunction, calls };
};

const authorizationOf = (
  fetchSpy: jest.SpiedFunction<typeof fetch>,
  callIndex: number,
): string | null => {
  const [, init] = fetchSpy.mock.calls[callIndex];
  return new Headers(init?.headers).get('authorization');
};

const requestMethodCases: {
  name: string;
  run: (
    repository: GithubStoryGateIssueRepository,
    issue: GithubIssueReference,
  ) => Promise<unknown>;
  response: () => Response;
}[] = [
  {
    name: 'findIssue',
    run: (repository, issue) => repository.findIssue(issue),
    response: issueResponse,
  },
  {
    name: 'listIssueComments',
    run: (repository, issue) => repository.listIssueComments(issue),
    response: () => jsonResponse([]),
  },
  {
    name: 'findIssueProjectItems',
    run: (repository, issue) => repository.findIssueProjectItems(issue),
    response: () =>
      jsonResponse({
        data: {
          repository: {
            issueOrPullRequest: {
              state: 'OPEN',
              projectItems: { nodes: [] },
            },
          },
        },
      }),
  },
  {
    name: 'listClosingPullRequests',
    run: (repository, issue) => repository.listClosingPullRequests(issue),
    response: () =>
      jsonResponse({
        data: {
          repository: {
            issueOrPullRequest: {
              timelineItems: { nodes: [] },
            },
          },
        },
      }),
  },
];

const issueCases: { issue: GithubIssueReference; expectedToken: string }[] = [
  { issue: ISSUE_A, expectedToken: 'token-a' },
  { issue: ISSUE_B, expectedToken: 'token-b' },
];

const tokenCases = requestMethodCases.flatMap((requestMethodCase) =>
  issueCases.map((issueCase) => ({ ...requestMethodCase, ...issueCase })),
);

describe('GithubStoryGateIssueRepository token selection', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(tokenCases)(
    '$name for $issue.url sends the token that the function returns for that URL (criterion 8)',
    async ({ run, response, issue, expectedToken }) => {
      const { tokenFunction, calls } = tokenFunctionCreate();
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(response());
      const repository = new GithubStoryGateIssueRepository(
        tokenFunction,
        noWait,
      );

      await run(repository, issue);

      expect(calls).toContain(issue.url);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(authorizationOf(fetchSpy, 0)).toBe(`Bearer ${expectedToken}`);
    },
  );

  it('sends each request of one repository with the token for its own issue URL (criterion 8)', async () => {
    const { tokenFunction, calls } = tokenFunctionCreate();
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(issueResponse())
      .mockResolvedValueOnce(issueResponse());
    const repository = new GithubStoryGateIssueRepository(
      tokenFunction,
      noWait,
    );

    await repository.findIssue(ISSUE_A);
    await repository.findIssue(ISSUE_B);

    expect(authorizationOf(fetchSpy, 0)).toBe('Bearer token-a');
    expect(authorizationOf(fetchSpy, 1)).toBe('Bearer token-b');
    expect(calls).toEqual([ISSUE_A.url, ISSUE_B.url]);
  });
});
