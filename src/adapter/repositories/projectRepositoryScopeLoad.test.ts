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
      unlistedSiblingOwners: [],
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
      unlistedSiblingOwners: ['example-owner'],
    });
  });

  test('a config without an org yields no scope', () => {
    const own = configWrite('own.config.yml', 'agents:\n  - developer-agent\n');

    expect(projectRepositoryScopeLoad(own)).toBeNull();
  });
});
