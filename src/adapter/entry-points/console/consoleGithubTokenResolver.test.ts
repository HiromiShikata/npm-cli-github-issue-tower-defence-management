import {
  createConsoleGithubTokenResolver,
  extractRepositoryOwner,
} from './consoleGithubTokenResolver';

describe('extractRepositoryOwner', () => {
  it('should return the owner of an issue url', () => {
    expect(
      extractRepositoryOwner(
        'https://github.com/meta-site/hr-audit-mock/issues/178',
      ),
    ).toBe('meta-site');
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
      extractRepositoryOwner('https://github.com/meta-site/hr-audit-mock'),
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
      { 'meta-site': '/creds/meta-site-token.txt' },
      (filePath) =>
        filePath === '/creds/meta-site-token.txt'
          ? 'fine-grained-token\n'
          : (() => {
              throw new Error(`unexpected file path: ${filePath}`);
            })(),
    );

    expect(resolve('meta-site')).toBe('fine-grained-token');
  });

  it('should keep using the default token for the other owners when one owner has a token file', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { 'meta-site': '/creds/meta-site-token.txt' },
      () => 'fine-grained-token',
    );

    expect(resolve('X-Mile')).toBe('default-token');
  });

  it('should read the token file only once per owner', () => {
    let readCount = 0;
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { 'meta-site': '/creds/meta-site-token.txt' },
      () => {
        readCount += 1;
        return 'fine-grained-token';
      },
    );

    resolve('meta-site');
    resolve('meta-site');

    expect(readCount).toBe(1);
  });

  it('should throw when the configured token file contains no token', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { 'meta-site': '/creds/meta-site-token.txt' },
      () => '  \n',
    );

    expect(() => resolve('meta-site')).toThrow(
      'The GitHub token file configured for repository owner "meta-site" contains no token: /creds/meta-site-token.txt',
    );
  });

  it('should surface the read failure when the configured token file cannot be read', () => {
    const resolve = createConsoleGithubTokenResolver(
      'default-token',
      { 'meta-site': '/creds/meta-site-token.txt' },
      () => {
        throw new Error('ENOENT: no such file or directory');
      },
    );

    expect(() => resolve('meta-site')).toThrow(
      'ENOENT: no such file or directory',
    );
  });
});
