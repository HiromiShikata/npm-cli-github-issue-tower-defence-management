import {
  issueAddableByProjectScope,
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
    unlistedSiblingOwners: [],
  };
  const unlistedWithSiblingScope: ProjectRepositoryScope = {
    org: 'example-owner',
    repositories: null,
    listedRepositoriesOfOtherProjects: ['example-owner/example-tasks'],
    unlistedSiblingOwners: [],
  };
  const listedScope: ProjectRepositoryScope = {
    org: 'example-owner',
    repositories: ['example-owner/example-tasks'],
    listedRepositoriesOfOtherProjects: [],
    unlistedSiblingOwners: [],
  };
  const listedWithUnlistedSiblingScope: ProjectRepositoryScope = {
    org: 'example-owner',
    repositories: ['example-owner/example-tasks'],
    listedRepositoriesOfOtherProjects: [],
    unlistedSiblingOwners: ['example-owner'],
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
      case: 'an unlisted project compares the owner exactly, as the owner check did before',
      scope: ownerOnlyScope,
      issue: reference('Example-Owner', 'anything'),
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
      case: 'a listed project owns its listed repository, ignoring letter case',
      scope: listedScope,
      issue: reference('Example-Owner', 'Example-Tasks'),
      expected: true,
    },
    {
      case: 'a listed project owns an unlisted repository of its owner when no unlisted sibling of that owner exists, as the StoryGate fallback does',
      scope: listedScope,
      issue: reference('example-owner', 'other-repo'),
      expected: true,
    },
    {
      case: 'a listed project does not own an unlisted repository when an unlisted sibling of the same owner exists',
      scope: listedWithUnlistedSiblingScope,
      issue: reference('example-owner', 'other-repo'),
      expected: false,
    },
    {
      case: 'a listed project does not own a repository of another owner',
      scope: listedScope,
      issue: reference('other-owner', 'other-repo'),
      expected: false,
    },
  ])('$case', ({ scope, issue, expected }) => {
    expect(issueBelongsToProjectScope(issue, scope)).toBe(expected);
  });
});

describe('issueAddableByProjectScope', () => {
  const unlistedScope: ProjectRepositoryScope = {
    org: 'testOrg',
    repositories: null,
    listedRepositoriesOfOtherProjects: ['testorg/testrepo'],
    unlistedSiblingOwners: [],
  };
  const unlistedScopeWithoutSibling: ProjectRepositoryScope = {
    org: 'testOrg',
    repositories: null,
    listedRepositoriesOfOtherProjects: [],
    unlistedSiblingOwners: [],
  };
  const listedScope: ProjectRepositoryScope = {
    org: 'testOrg',
    repositories: ['testOrg/testRepo'],
    listedRepositoriesOfOtherProjects: [],
    unlistedSiblingOwners: [],
  };

  test.each([
    {
      case: 'an unlisted project adds an issue of another owner that no project lists, as before',
      scope: unlistedScopeWithoutSibling,
      issue: reference('other-owner', 'repo'),
      expected: true,
    },
    {
      case: 'an unlisted project skips an issue of a repository listed by its sibling, ignoring case',
      scope: unlistedScope,
      issue: reference('testOrg', 'testRepo'),
      expected: false,
    },
    {
      case: 'a listed project adds an issue of its listed repository',
      scope: listedScope,
      issue: reference('testOrg', 'testRepo'),
      expected: true,
    },
    {
      case: 'a listed project adds an unlisted repository of its owner when no unlisted sibling exists, as the resolver fallback does',
      scope: listedScope,
      issue: reference('testOrg', 'other-repo'),
      expected: true,
    },
    {
      case: 'a listed project skips an unlisted repository of its owner when an unlisted sibling of that owner exists',
      scope: {
        ...listedScope,
        unlistedSiblingOwners: ['testOrg'],
      },
      issue: reference('testOrg', 'other-repo'),
      expected: false,
    },
  ])('$case', ({ scope, issue, expected }) => {
    expect(issueAddableByProjectScope(issue, scope)).toBe(expected);
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
