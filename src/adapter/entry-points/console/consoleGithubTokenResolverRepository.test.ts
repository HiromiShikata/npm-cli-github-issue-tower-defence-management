import {
  createConsoleGithubTokenResolver,
  createConsoleGithubTokenResolverByRepository,
} from './consoleGithubTokenResolver';

const ALPHA_URL = 'https://github.com/users/example-owner/projects/1';
const BETA_URL = 'https://github.com/users/example-owner/projects/2';
const CONSOLE_PROJECTS = { alpha: ALPHA_URL, beta: BETA_URL };
const CONSOLE_TOKENS = { alpha: 'token-alpha', beta: 'token-beta' };
const DEFAULT_TOKEN = 'token-default';
const LISTED = { alpha: ['example-owner/example-tasks'] };

const resolverOf = (repositories: Record<string, string[]> | null = LISTED) =>
  createConsoleGithubTokenResolverByRepository(
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
    expect(
      createConsoleGithubTokenResolver(
        DEFAULT_TOKEN,
        CONSOLE_PROJECTS,
        CONSOLE_TOKENS,
        null,
      )('example-owner'),
    ).toBe('token-alpha');
  });

  test('the owner-only call keeps the first owner match', () => {
    expect(
      createConsoleGithubTokenResolver(
        DEFAULT_TOKEN,
        CONSOLE_PROJECTS,
        CONSOLE_TOKENS,
        LISTED,
      )('example-owner'),
    ).toBe('token-alpha');
  });

  test('a repository lookup and an owner lookup do not share a cached token', () => {
    const resolve = resolverOf();
    expect(resolve('example-owner', 'other-repo')).toBe('token-beta');
    expect(resolve('example-owner', 'example-tasks')).toBe('token-alpha');
    expect(
      createConsoleGithubTokenResolver(
        DEFAULT_TOKEN,
        CONSOLE_PROJECTS,
        CONSOLE_TOKENS,
        LISTED,
      )('example-owner'),
    ).toBe('token-alpha');
  });
});
