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
  it('should return the default token when consoleProjectUrls is null', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      null,
      null,
      () => {
        throw new Error('must not read any file');
      },
    );

    expect(resolve('HiromiShikata')).toBe('default-token');
  });

  it('should return the default token when githubTokenFileDirPath is null', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      null,
      () => {
        throw new Error('must not read any file');
      },
    );

    expect(resolve('acme-labs')).toBe('default-token');
  });

  it('should return the token read from the pjcode-named file for the matching project owner', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      '/creds',
      (filePath) =>
        filePath === '/creds/tdpm-github-token-acme.txt'
          ? 'fine-grained-token\n'
          : (() => {
              throw new Error(`unexpected file path: ${filePath}`);
            })(),
    );

    expect(resolve('acme-labs')).toBe('fine-grained-token');
  });

  it('should return the token for example-org when cmg project URL owner is example-org', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { cmg: 'https://github.com/orgs/example-org/projects/18' },
      '/token-dir',
      (filePath) =>
        filePath === '/token-dir/tdpm-github-token-cmg.txt'
          ? 'cmg-token'
          : (() => {
              throw new Error(`unexpected file path: ${filePath}`);
            })(),
    );

    expect(resolve('example-org')).toBe('cmg-token');
  });

  it('should keep using the default token for owners that match no project url', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      '/creds',
      () => 'fine-grained-token',
    );

    expect(resolve('globex-inc')).toBe('default-token');
  });

  it('should read the token file only once per owner', () => {
    let readCount = 0;
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      '/creds',
      () => {
        readCount += 1;
        return 'fine-grained-token';
      },
    );

    resolve('acme-labs');
    resolve('acme-labs');

    expect(readCount).toBe(1);
  });

  it('should throw when the token file for the matching pjcode contains no token', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      '/creds',
      () => '  \n',
    );

    expect(() => resolve('acme-labs')).toThrow(
      'The GitHub token file for pjcode "acme" contains no token: /creds/tdpm-github-token-acme.txt',
    );
  });

  it('should return the default token when the token file for the matching pjcode is absent', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      '/creds',
      () => {
        throw Object.assign(
          new Error(
            "ENOENT: no such file or directory, open '/creds/tdpm-github-token-acme.txt'",
          ),
          { code: 'ENOENT' },
        );
      },
    );

    expect(resolve('acme-labs')).toBe('default-token');
  });

  it('should rethrow a non-ENOENT error from the token file reader', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/acme-labs/projects/1' },
      '/creds',
      () => {
        throw Object.assign(
          new Error(
            "EACCES: permission denied, open '/creds/tdpm-github-token-acme.txt'",
          ),
          { code: 'EACCES' },
        );
      },
    );

    expect(() => resolve('acme-labs')).toThrow('EACCES: permission denied');
  });

  it('should match the project owner case-insensitively', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { acme: 'https://github.com/orgs/Acme-Labs/projects/1' },
      '/creds',
      () => 'fine-grained-token',
    );

    expect(resolve('acme-labs')).toBe('fine-grained-token');
  });
});
