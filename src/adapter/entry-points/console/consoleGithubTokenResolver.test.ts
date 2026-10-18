import {
  createConsoleGithubTokenResolver,
  createConsoleGithubTokenResolverByItemUrl,
  createConsoleIssueRepositoryResolver,
  createConsoleProjectNameResolver,
  createConsoleProjectRepositoryResolver,
  extractProjectOwner,
  extractRepositoryOwner,
} from './consoleGithubTokenResolver';

describe('extractProjectOwner', () => {
  it('should return the organization login of an organization project url', () => {
    expect(
      extractProjectOwner('https://github.com/orgs/acme/projects/18'),
    ).toBe('acme');
  });

  it('should return the user login of a user project url', () => {
    expect(
      extractProjectOwner('https://github.com/users/acme-owner/projects/48'),
    ).toBe('acme-owner');
  });

  it('should return null for a url that is not a project url', () => {
    expect(
      extractProjectOwner('https://github.com/acme/acme-repository/issues/178'),
    ).toBeNull();
  });
});

describe('createConsoleProjectRepositoryResolver', () => {
  it('builds the project repository from the token of the owner in the project url', () => {
    const resolve = createConsoleProjectRepositoryResolver<string>(
      (repositoryOwner) => `token-of-${repositoryOwner}`,
      (githubToken) => `repository-with-${githubToken}`,
    );

    expect(resolve('https://github.com/orgs/acme/projects/18')).toBe(
      'repository-with-token-of-acme',
    );
  });

  it('throws when the project owner cannot be read from the project url', () => {
    const resolve = createConsoleProjectRepositoryResolver<string>(
      (repositoryOwner) => `token-of-${repositoryOwner}`,
      (githubToken) => `repository-with-${githubToken}`,
    );

    expect(() => resolve('https://github.com/orgs/acme')).toThrow(
      'The project owner cannot be read from the project url: https://github.com/orgs/acme',
    );
  });
});

describe('createConsoleGithubTokenResolverByItemUrl', () => {
  it('returns the token for the owner of the given item url', () => {
    const resolve = createConsoleGithubTokenResolverByItemUrl(
      (repositoryOwner) => `token-of-${repositoryOwner}`,
    );

    expect(
      resolve('https://github.com/acme-labs/acme-portal-mock/issues/178'),
    ).toBe('token-of-acme-labs');
  });

  it('throws when the repository owner cannot be read from the url', () => {
    const resolve = createConsoleGithubTokenResolverByItemUrl(
      (repositoryOwner) => `token-of-${repositoryOwner}`,
    );

    expect(() =>
      resolve('https://github.com/acme-labs/acme-portal-mock'),
    ).toThrow(
      'The repository owner cannot be read from the url: https://github.com/acme-labs/acme-portal-mock',
    );
  });
});

describe('createConsoleIssueRepositoryResolver', () => {
  it('builds the issue repository from the token of the owner in the url', () => {
    const resolve = createConsoleIssueRepositoryResolver<string>(
      (repositoryOwner) => `token-of-${repositoryOwner}`,
      (githubToken) => `repository-with-${githubToken}`,
    );

    expect(
      resolve('https://github.com/acme-labs/acme-portal-mock/issues/178'),
    ).toBe('repository-with-token-of-acme-labs');
  });

  it('throws when the repository owner cannot be read from the url', () => {
    const resolve = createConsoleIssueRepositoryResolver<string>(
      (repositoryOwner) => `token-of-${repositoryOwner}`,
      (githubToken) => `repository-with-${githubToken}`,
    );

    expect(() =>
      resolve('https://github.com/acme-labs/acme-portal-mock'),
    ).toThrow(
      'The repository owner cannot be read from the operated url: https://github.com/acme-labs/acme-portal-mock',
    );
  });
});

describe('extractRepositoryOwner', () => {
  it('should return the owner of an issue url', () => {
    expect(
      extractRepositoryOwner(
        'https://github.com/acme-labs/acme-portal-mock/issues/178',
      ),
    ).toBe('acme-labs');
  });

  it('should return the owner of a pull request url', () => {
    expect(
      extractRepositoryOwner(
        'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/1399',
      ),
    ).toBe('HiromiShikata');
  });

  it('should return null for a url that is not an issue or a pull request', () => {
    expect(
      extractRepositoryOwner('https://github.com/acme-labs/acme-portal-mock'),
    ).toBeNull();
  });
});

describe('createConsoleGithubTokenResolver', () => {
  it('should return the default token when consoleProjectUrls is null', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      null,
      null,
    );

    expect(resolve('HiromiShikata')).toBe('default-token');
  });

  it('should return the default token when consoleGithubTokens is null', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      null,
    );

    expect(resolve('acme-labs')).toBe('default-token');
  });

  it('should return the token from the map for the matching project owner', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      { acme: 'fine-grained-token' },
    );

    expect(resolve('acme-labs')).toBe('fine-grained-token');
  });

  it('should return the cmg token when the cmg project URL owner is example-org', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { cmg: 'https://github.com/orgs/example-org/projects/18' },
      { cmg: 'cmg-token' },
    );

    expect(resolve('example-org')).toBe('cmg-token');
  });

  it('should keep using the default token for owners that match no project url', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      { acme: 'fine-grained-token' },
    );

    expect(resolve('globex-inc')).toBe('default-token');
  });

  it('should cache the resolved token and not re-read the map on subsequent calls for the same owner', () => {
    const tokens: Record<string, string> = { acme: 'fine-grained-token' };
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      tokens,
    );

    resolve('acme-labs');
    tokens['acme'] = 'updated-token';
    const secondResult = resolve('acme-labs');

    expect(secondResult).toBe('fine-grained-token');
  });

  it('should throw when the matching pjcode has no entry in consoleGithubTokens', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      {},
    );

    expect(() => resolve('acme-labs')).toThrow(
      'The GitHub token for pjcode "acme" is not configured: set consoleGithubTokens.acme in the console config file',
    );
  });

  it('should throw when the matching pjcode token value is blank', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      { acme: '  \n' },
    );

    expect(() => resolve('acme-labs')).toThrow(
      'The GitHub token for pjcode "acme" is not configured: set consoleGithubTokens.acme in the console config file',
    );
  });

  it('should match the project owner case-insensitively', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/Acme-Labs/projects/1' },
      { acme: 'fine-grained-token' },
    );

    expect(resolve('acme-labs')).toBe('fine-grained-token');
  });

  it('keeps resolving the own token of a repository owner from the console project urls', () => {
    const ownTokenCases: {
      name: string;
      consoleProjectUrls: Record<string, string>;
      consoleGithubTokens: Record<string, string>;
      repositoryOwner: string;
      expectedToken: string;
    }[] = [
      {
        name: 'the first console project wins when two projects share the owner',
        consoleProjectUrls: {
          acme: 'https://github.com/orgs/acme-labs/projects/1',
          acmeSecond: 'https://github.com/orgs/acme-labs/projects/2',
        },
        consoleGithubTokens: {
          acme: 'acme-token',
          acmeSecond: 'acme-second-token',
        },
        repositoryOwner: 'acme-labs',
        expectedToken: 'acme-token',
      },
      {
        name: 'the configured token is trimmed',
        consoleProjectUrls: {
          acme: 'https://github.com/orgs/acme-labs/projects/1',
        },
        consoleGithubTokens: { acme: '  acme-token\n' },
        repositoryOwner: 'acme-labs',
        expectedToken: 'acme-token',
      },
      {
        name: 'a user project url matches its user login',
        consoleProjectUrls: {
          umino: 'https://github.com/users/HiromiShikata/projects/1',
        },
        consoleGithubTokens: { umino: 'umino-token' },
        repositoryOwner: 'HiromiShikata',
        expectedToken: 'umino-token',
      },
      {
        name: 'an uppercase repository owner matches a lowercase project url',
        consoleProjectUrls: {
          acme: 'https://github.com/orgs/acme-labs/projects/1',
        },
        consoleGithubTokens: { acme: 'acme-token' },
        repositoryOwner: 'ACME-LABS',
        expectedToken: 'acme-token',
      },
      {
        name: 'a project url whose owner cannot be read gives the default token',
        consoleProjectUrls: { broken: 'https://github.com/broken-owner' },
        consoleGithubTokens: { broken: 'broken-token' },
        repositoryOwner: 'broken-owner',
        expectedToken: 'default-token',
      },
    ];

    const observed = ownTokenCases.map((ownTokenCase) => ({
      name: ownTokenCase.name,
      token: createConsoleGithubTokenResolver(
        'default-token',
        ownTokenCase.consoleProjectUrls,
        ownTokenCase.consoleGithubTokens,
      )(ownTokenCase.repositoryOwner),
    }));

    expect(observed).toEqual(
      ownTokenCases.map((ownTokenCase) => ({
        name: ownTokenCase.name,
        token: ownTokenCase.expectedToken,
      })),
    );
  });
});

describe('createConsoleProjectNameResolver', () => {
  it('returns the first console project name whose project url owner matches the repository owner case-insensitively, or null when none matches', () => {
    const resolveProjectName = createConsoleProjectNameResolver({
      umino: 'https://github.com/users/HiromiShikata/projects/1',
      acme: 'https://github.com/orgs/acme-labs/projects/2',
      acmeSecond: 'https://github.com/orgs/acme-labs/projects/3',
      broken: 'https://github.com/broken-owner',
    });
    const projectNameCases: {
      repositoryOwner: string;
      expectedProjectName: string | null;
    }[] = [
      { repositoryOwner: 'HiromiShikata', expectedProjectName: 'umino' },
      { repositoryOwner: 'hiromishikata', expectedProjectName: 'umino' },
      { repositoryOwner: 'ACME-LABS', expectedProjectName: 'acme' },
      { repositoryOwner: 'globex', expectedProjectName: null },
      { repositoryOwner: 'broken-owner', expectedProjectName: null },
    ];

    const observed = projectNameCases.map((projectNameCase) => ({
      repositoryOwner: projectNameCase.repositoryOwner,
      projectName: resolveProjectName(projectNameCase.repositoryOwner),
    }));

    expect(observed).toEqual(
      projectNameCases.map((projectNameCase) => ({
        repositoryOwner: projectNameCase.repositoryOwner,
        projectName: projectNameCase.expectedProjectName,
      })),
    );
  });

  it('returns null for every repository owner when the console project urls are not configured', () => {
    const resolveProjectName = createConsoleProjectNameResolver(null);

    expect(
      ['HiromiShikata', 'acme-labs'].map((repositoryOwner) =>
        resolveProjectName(repositoryOwner),
      ),
    ).toEqual([null, null]);
  });
});
