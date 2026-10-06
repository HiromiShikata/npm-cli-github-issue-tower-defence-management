/**
 * @jest-environment node
 */
import jestConfig from './jest.config';
import fs from 'node:fs';
import path from 'node:path';

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
