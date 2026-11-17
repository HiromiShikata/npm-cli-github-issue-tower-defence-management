import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectRepositoryScopeLoad } from './projectRepositoryScopeLoad';

describe('projectRepositoryScopeLoad', () => {
  let configDirectory: string;

  beforeEach(() => {
    configDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-scope-'));
  });

  afterEach(() => {
    fs.rmSync(configDirectory, { recursive: true, force: true });
  });

  const configWrite = (fileName: string, content: string): string => {
    const filePath = path.join(configDirectory, fileName);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  test('an owner-only project has no repository list and sees no sibling listing', () => {
    const own = configWrite(
      'own.config.yml',
      'org: example-owner\nprojectUrl: https://github.com/users/example-owner/projects/2\n',
    );
    configWrite(
      'sibling.config.yml',
      'org: example-owner\nprojectUrl: https://github.com/users/example-owner/projects/1\nrepositories:\n  - example-owner/example-tasks\n',
    );

    expect(projectRepositoryScopeLoad(own)).toEqual({
      org: 'example-owner',
      repositories: null,
      listedRepositoriesOfOtherProjects: ['example-owner/example-tasks'],
      ownsUnlistedRepositoriesOfOwner: false,
    });
  });

  test('a listed project lists its own repositories and not its own entries as other projects', () => {
    const own = configWrite(
      'own.config.yml',
      'org: example-owner\nprojectUrl: https://github.com/users/example-owner/projects/1\nrepositories:\n  - example-owner/example-tasks\n',
    );
    configWrite(
      'sibling.config.yml',
      'org: example-owner\nprojectUrl: https://github.com/users/example-owner/projects/2\n',
    );

    expect(projectRepositoryScopeLoad(own)).toEqual({
      org: 'example-owner',
      repositories: ['example-owner/example-tasks'],
      listedRepositoriesOfOtherProjects: [],
      ownsUnlistedRepositoriesOfOwner: false,
    });
  });

  test('loads the own config when its filename does not match the project pattern', () => {
    const own = configWrite(
      'config.yml',
      'org: example-owner\nprojectUrl: https://github.com/users/example-owner/projects/1\nrepositories:\n  - example-owner/example-tasks\n',
    );
    configWrite(
      'sibling.config.yml',
      'org: example-owner\nprojectUrl: https://github.com/users/example-owner/projects/2\nrepositories:\n  - example-owner/example-other-tasks\n',
    );

    expect(projectRepositoryScopeLoad(own)).toEqual({
      org: 'example-owner',
      repositories: ['example-owner/example-tasks'],
      listedRepositoriesOfOtherProjects: ['example-owner/example-other-tasks'],
      ownsUnlistedRepositoriesOfOwner: false,
    });
  });

  test('a config without an org yields no scope', () => {
    const own = configWrite('own.config.yml', 'agents:\n  - developer-agent\n');

    expect(projectRepositoryScopeLoad(own)).toBeNull();
  });
});

describe('projectRepositoryScopeLoad with two listed projects of one owner', () => {
  let configDirectory: string;

  beforeEach(() => {
    configDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'repo-scope-pair-'),
    );
  });

  afterEach(() => {
    fs.rmSync(configDirectory, { recursive: true, force: true });
  });

  test.each([
    {
      case: 'a listed project does not own the owner fallback when every same-owner project lists repositories',
      ownFileName: 'a.config.yml',
      expectedOwnsFallback: false,
      expectedOtherListed: ['example-owner/repo-b'],
    },
    {
      case: 'a later listed project also does not own the owner fallback',
      ownFileName: 'b.config.yml',
      expectedOwnsFallback: false,
      expectedOtherListed: ['example-owner/repo-a'],
    },
  ])('$case', ({ ownFileName, expectedOwnsFallback, expectedOtherListed }) => {
    fs.writeFileSync(
      path.join(configDirectory, 'a.config.yml'),
      'org: example-owner\nprojectUrl: https://github.com/users/example-owner/projects/1\nrepositories:\n  - example-owner/repo-a\n',
    );
    fs.writeFileSync(
      path.join(configDirectory, 'b.config.yml'),
      'org: example-owner\nprojectUrl: https://github.com/users/example-owner/projects/2\nrepositories:\n  - example-owner/repo-b\n',
    );

    expect(
      projectRepositoryScopeLoad(path.join(configDirectory, ownFileName)),
    ).toEqual({
      org: 'example-owner',
      repositories: [
        ownFileName === 'a.config.yml'
          ? 'example-owner/repo-a'
          : 'example-owner/repo-b',
      ],
      listedRepositoriesOfOtherProjects: expectedOtherListed,
      ownsUnlistedRepositoriesOfOwner: expectedOwnsFallback,
    });
  });
});
