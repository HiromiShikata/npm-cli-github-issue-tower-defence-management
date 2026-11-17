import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectRepositoryListsByPjcodeLoad } from './projectRepositoryListsLoad';

const ALPHA_URL = 'https://github.com/users/example-owner/projects/1';
const BETA_URL = 'https://github.com/users/example-owner/projects/2';

describe('projectRepositoryListsByPjcodeLoad', () => {
  let configDirectory: string;

  beforeEach(() => {
    configDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-lists-'));
  });

  afterEach(() => {
    fs.rmSync(configDirectory, { recursive: true, force: true });
  });

  const configWrite = (fileName: string, content: string): void => {
    fs.writeFileSync(path.join(configDirectory, fileName), content);
  };

  test.each<{
    case: string;
    directory: string | null;
    consoleProjects: Record<string, string> | null;
    files: Record<string, string>;
    expected: Record<string, string[]> | null;
  }>([
    {
      case: 'no config directory yields null',
      directory: null,
      consoleProjects: { alpha: ALPHA_URL },
      files: {},
      expected: null,
    },
    {
      case: 'no console projects yields null',
      directory: 'use-temp',
      consoleProjects: null,
      files: {},
      expected: null,
    },
    {
      case: 'a config with repositories is keyed by the console project whose URL matches, ignoring case and trailing slash',
      directory: 'use-temp',
      consoleProjects: { alpha: ALPHA_URL, beta: BETA_URL },
      files: {
        'a.config.yml': `org: example-owner\nprojectUrl: ${ALPHA_URL.toUpperCase()}/\nrepositories:\n  - example-owner/example-tasks\n`,
        'b.config.yml': `org: example-owner\nprojectUrl: ${BETA_URL}\n`,
      },
      expected: { alpha: ['example-owner/example-tasks'] },
    },
    {
      case: 'a config whose projectUrl matches no console project is skipped',
      directory: 'use-temp',
      consoleProjects: { alpha: ALPHA_URL },
      files: {
        'a.config.yml': `org: example-owner\nprojectUrl: ${BETA_URL}\nrepositories:\n  - example-owner/example-tasks\n`,
      },
      expected: {},
    },
  ])('$case', ({ directory, consoleProjects, files, expected }) => {
    for (const [fileName, content] of Object.entries(files)) {
      configWrite(fileName, content);
    }
    expect(
      projectRepositoryListsByPjcodeLoad(
        directory === null ? null : configDirectory,
        consoleProjects,
      ),
    ).toEqual(expected);
  });
});
