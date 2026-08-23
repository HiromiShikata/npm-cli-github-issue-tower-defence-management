import {
  createConsoleGithubTokenResolver,
  createConsoleGithubTokenResolverByItemUrl,
  createConsoleIssueRepositoryResolver,
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
  it('should return the default token for an owner that has no token file configured', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      null,
      () => {
        throw new Error('must not read any file');
      },
    );

    expect(resolve('HiromiShikata')).toBe('default-token');
  });

  it('should return the token read from the file configured for that owner', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { 'acme-labs': '/creds/acme-labs-token.txt' },
      (filePath) =>
        filePath === '/creds/acme-labs-token.txt'
          ? 'fine-grained-token\n'
          : (() => {
              throw new Error(`unexpected file path: ${filePath}`);
            })(),
    );

    expect(resolve('acme-labs')).toBe('fine-grained-token');
  });

  it('should throw when the per-owner token map is provided but the owner has no entry in it', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { 'acme-labs': '/creds/acme-labs-token.txt' },
      () => 'fine-grained-token',
    );

    expect(() => resolve('globex-inc')).toThrow(
      'No GitHub token file is configured for repository owner "globex-inc". Add an entry for this owner in consoleGithubTokenFilesByRepositoryOwner.',
    );
  });

  it('should read the token file only once per owner', () => {
    let readCount = 0;
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { 'acme-labs': '/creds/acme-labs-token.txt' },
      () => {
        readCount += 1;
        return 'fine-grained-token';
      },
    );

    resolve('acme-labs');
    resolve('acme-labs');

    expect(readCount).toBe(1);
  });

  it('should throw when the configured token file contains no token', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { 'acme-labs': '/creds/acme-labs-token.txt' },
      () => '  \n',
    );

    expect(() => resolve('acme-labs')).toThrow(
      'The GitHub token file configured for repository owner "acme-labs" contains no token: /creds/acme-labs-token.txt',
    );
  });

  it('should surface the read failure when the configured token file cannot be read', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { 'acme-labs': '/creds/acme-labs-token.txt' },
      () => {
        throw new Error('ENOENT: no such file or directory');
      },
    );

    expect(() => resolve('acme-labs')).toThrow(
      'ENOENT: no such file or directory',
    );
  });
});
