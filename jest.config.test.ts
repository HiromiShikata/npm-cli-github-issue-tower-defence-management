/**
 * @jest-environment node
 */
import jestConfig from './jest.config';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type JestProjectConfig = {
  displayName?: string | { name: string; color?: string };
  testMatch?: string[];
};

describe('jest.config', () => {
  it("console-ui project's testMatch collects only src test files, not e2e (pre-#3216 scope)", () => {
    const projects = jestConfig.projects as JestProjectConfig[];
    const consoleUiProject = projects.find(
      (project) => project.displayName === 'console-ui',
    );
    expect(consoleUiProject?.testMatch).toEqual([
      '<rootDir>/src/**/*.test.{ts,tsx}',
    ]);
  });
});

describe('console/ui/e2e tsconfig.json', () => {
  it("declares only 'node' in compilerOptions.types, not 'jest' (pre-#3216 scope)", () => {
    const tsconfigPath = path.join(
      __dirname,
      'src',
      'adapter',
      'entry-points',
      'console',
      'ui',
      'e2e',
      'tsconfig.json',
    );
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8')) as {
      compilerOptions: { types: string[] };
    };
    expect(tsconfig.compilerOptions.types).toEqual(['node']);
  });
});

describe('console/ui/e2e/playwright.config.test.ts', () => {
  it('does not exist (pre-#3216 scope)', () => {
    const playwrightConfigTestPath = path.join(
      __dirname,
      'src',
      'adapter',
      'entry-points',
      'console',
      'ui',
      'e2e',
      'playwright.config.test.ts',
    );
    expect(fs.existsSync(playwrightConfigTestPath)).toBe(false);
  });
});

const isTestFilePath = (line: string): boolean =>
  /\.(test|spec)\.tsx?$/.test(line);

const runJestListTests = (selectProjects: string[]): string[] => {
  const result = spawnSync(
    'npx',
    ['jest', '--selectProjects', ...selectProjects, '--listTests'],
    {
      cwd: __dirname,
      encoding: 'utf8',
      timeout: 60000,
    },
  );
  if (result.error) {
    throw result.error;
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

describe('jest.config.js project split between the blocking test run and the live-credentialed integration run', () => {
  it('does not list GraphqlProjectItemRepository.integration.test.ts when selecting the backend and console-ui projects that back the blocking "test" npm script', () => {
    const listedTestFileNames = runJestListTests(['backend', 'console-ui'])
      .filter(isTestFilePath)
      .map((filePath) => path.basename(filePath));

    expect(listedTestFileNames).not.toContain(
      'GraphqlProjectItemRepository.integration.test.ts',
    );
  });

  it('lists exactly GraphqlProjectItemRepository.integration.test.ts when selecting the backend-live-integration project', () => {
    const listedTestFilePaths = runJestListTests([
      'backend-live-integration',
    ]).filter(isTestFilePath);

    expect(listedTestFilePaths).toHaveLength(1);
    expect(path.basename(listedTestFilePaths[0])).toBe(
      'GraphqlProjectItemRepository.integration.test.ts',
    );
  });

  it('still lists the trimmed GraphqlProjectItemRepository.test.ts and the pre-existing live-credentialed GoogleSpreadsheetRepository.integration.test.ts and KySlackRepository.test.ts when selecting the backend project', () => {
    const listedTestFileNames = runJestListTests(['backend'])
      .filter(isTestFilePath)
      .map((filePath) => path.basename(filePath));

    expect(listedTestFileNames).toContain(
      'GraphqlProjectItemRepository.test.ts',
    );
    expect(listedTestFileNames).toContain(
      'GoogleSpreadsheetRepository.integration.test.ts',
    );
    expect(listedTestFileNames).toContain('KySlackRepository.test.ts');
  });
});
