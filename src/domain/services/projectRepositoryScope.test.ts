import {
  issueBelongsToProjectScope,
  projectConfigForRepositoryResolve,
  projectUrlKeyOf,
  ProjectRepositoryScope,
  ProjectScopeConfig,
} from './projectRepositoryScope';

const config = (
  projectUrl: string,
  repositories: string[] | null,
  org = 'example-owner',
): ProjectScopeConfig & { name: string } => ({
  name: projectUrl,
  org,
  projectUrl,
  repositories,
});

const reference = (owner: string, repo: string) => ({ owner, repo });

describe('projectConfigForRepositoryResolve', () => {
  const listedA = config('https://github.com/users/example-owner/projects/1', [
    'example-owner/example-tasks',
  ]);
  const unlisted = config(
    'https://github.com/users/example-owner/projects/2',
    null,
  );
  const otherOwner = config(
    'https://github.com/users/other-owner/projects/3',
    null,
    'other-owner',
  );

  test.each([
    {
      case: 'a listed repository selects its listed config even when an unlisted same-owner config comes first',
      configs: [unlisted, listedA],
      issue: reference('example-owner', 'example-tasks'),
      expected: listedA,
    },
    {
      case: 'the listed repository match ignores letter case',
      configs: [unlisted, listedA],
      issue: reference('Example-Owner', 'EXAMPLE-TASKS'),
      expected: listedA,
    },
    {
      case: 'an unlisted repository of the same owner goes to the unlisted config, not the listed one',
      configs: [listedA, unlisted],
      issue: reference('example-owner', 'other-repo'),
      expected: unlisted,
    },
    {
      case: 'an unlisted repository falls back to the owner match when only a listed config has that owner',
      configs: [listedA, otherOwner],
      issue: reference('example-owner', 'other-repo'),
      expected: listedA,
    },
    {
      case: 'a listed repository name under a different owner does not match',
      configs: [listedA],
      issue: reference('other-owner', 'example-tasks'),
      expected: undefined,
    },
    {
      case: 'an owner with no config resolves to undefined',
      configs: [unlisted],
      issue: reference('nobody', 'repo'),
      expected: undefined,
    },
  ])('$case', ({ configs, issue, expected }) => {
    expect(projectConfigForRepositoryResolve(configs, issue)).toBe(expected);
  });
});

describe('issueBelongsToProjectScope', () => {
  const ownerOnlyScope: ProjectRepositoryScope = {
    org: 'example-owner',
    repositories: null,
    listedRepositoriesOfOtherProjects: [],
  };
  const unlistedWithSiblingScope: ProjectRepositoryScope = {
    org: 'example-owner',
    repositories: null,
    listedRepositoriesOfOtherProjects: ['example-owner/example-tasks'],
  };
  const listedScope: ProjectRepositoryScope = {
    org: 'example-owner',
    repositories: ['example-owner/example-tasks'],
    listedRepositoriesOfOtherProjects: [],
  };

  test.each([
    {
      case: 'an owner-only project owns every repository of its owner',
      scope: ownerOnlyScope,
      issue: reference('example-owner', 'anything'),
      expected: true,
    },
    {
      case: 'an owner-only project does not own a repository of another owner',
      scope: ownerOnlyScope,
      issue: reference('other-owner', 'anything'),
      expected: false,
    },
    {
      case: 'an unlisted project does not own a repository listed by its sibling project',
      scope: unlistedWithSiblingScope,
      issue: reference('example-owner', 'example-tasks'),
      expected: false,
    },
    {
      case: 'an unlisted project still owns its other repositories of the same owner',
      scope: unlistedWithSiblingScope,
      issue: reference('example-owner', 'other-repo'),
      expected: true,
    },
    {
      case: 'a listed project owns its listed repository',
      scope: listedScope,
      issue: reference('Example-Owner', 'Example-Tasks'),
      expected: true,
    },
    {
      case: 'a listed project does not own an unlisted repository of the same owner',
      scope: listedScope,
      issue: reference('example-owner', 'other-repo'),
      expected: false,
    },
  ])('$case', ({ scope, issue, expected }) => {
    expect(issueBelongsToProjectScope(issue, scope)).toBe(expected);
  });
});

describe('projectUrlKeyOf', () => {
  test.each([
    {
      case: 'trailing slashes and letter case are ignored',
      url: 'https://github.com/Users/Example-Owner/projects/1/',
      expected: 'https://github.com/users/example-owner/projects/1',
    },
    {
      case: 'surrounding whitespace is ignored',
      url: '  https://github.com/users/example-owner/projects/1  ',
      expected: 'https://github.com/users/example-owner/projects/1',
    },
  ])('$case', ({ url, expected }) => {
    expect(projectUrlKeyOf(url)).toBe(expected);
  });
});
