import {
  createConsoleGithubTokenResolver,
  createConsoleIssueRepositoryResolver,
} from './consoleGithubTokenResolver';

const ALPHA_URL = 'https://github.com/users/example-owner/projects/1';
const BETA_URL = 'https://github.com/users/example-owner/projects/2';
const CONSOLE_PROJECTS = { alpha: ALPHA_URL, beta: BETA_URL };
const CONSOLE_TOKENS = { alpha: 'token-alpha', beta: 'token-beta' };
const DEFAULT_TOKEN = 'token-default';
const LISTED = { alpha: ['example-owner/example-tasks'] };

const resolverOf = (repositories: Record<string, string[]> | null = LISTED) =>
  createConsoleGithubTokenResolver(
    DEFAULT_TOKEN,
    CONSOLE_PROJECTS,
    CONSOLE_TOKENS,
    repositories,
  );

describe('createConsoleGithubTokenResolver by repository', () => {
  test.each([
    {
      case: 'a listed repository resolves to the project that lists it, not the first owner match',
      owner: 'example-owner',
      repo: 'example-tasks',
      expected: 'token-alpha',
    },
    {
      case: 'an unlisted repository of the same owner resolves to the unlisted project',
      owner: 'example-owner',
      repo: 'other-repo',
      expected: 'token-beta',
    },
    {
      case: 'the repository match ignores letter case',
      owner: 'Example-Owner',
      repo: 'EXAMPLE-TASKS',
      expected: 'token-alpha',
    },
    {
      case: 'an owner with no project falls back to the default token',
      owner: 'nobody',
      repo: 'repo',
      expected: DEFAULT_TOKEN,
    },
  ])('$case', ({ owner, repo, expected }) => {
    expect(resolverOf()(owner, repo)).toBe(expected);
  });

  test('without repository lists, a repository resolves exactly as the owner did before', () => {
    expect(resolverOf(null)('example-owner', 'example-tasks')).toBe(
      'token-alpha',
    );
  });

  test('the owner-only call keeps the first owner match', () => {
    expect(resolverOf()('example-owner')).toBe('token-alpha');
  });

  test('a repository lookup and an owner lookup do not share a cached token', () => {
    const resolve = resolverOf();
    expect(resolve('example-owner', 'other-repo')).toBe('token-beta');
    expect(resolve('example-owner', 'example-tasks')).toBe('token-alpha');
    expect(resolve('example-owner')).toBe('token-alpha');
  });
});

describe('createConsoleIssueRepositoryResolver passes the repository name', () => {
  test.each([
    {
      case: 'an issue URL of a listed repository asks for that repository',
      url: 'https://github.com/example-owner/example-tasks/issues/3',
      expectedArgs: ['example-owner', 'example-tasks'],
    },
    {
      case: 'a pull request URL of another repository asks for that repository',
      url: 'https://github.com/example-owner/other-repo/pull/7',
      expectedArgs: ['example-owner', 'other-repo'],
    },
  ])('$case', ({ url, expectedArgs }) => {
    const requestedArgs: unknown[][] = [];
    const resolveGithubToken = (...args: [string, string?]): string => {
      requestedArgs.push(args);
      return 'token';
    };
    createConsoleIssueRepositoryResolver(
      resolveGithubToken,
      (token) => token,
    )(url);
    expect(requestedArgs).toEqual([expectedArgs]);
  });
});
