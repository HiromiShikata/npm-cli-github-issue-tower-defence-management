import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

type TypecheckRunResult = {
  readonly exitCode: number | null;
  readonly combinedOutput: string;
};

const REPOSITORY_PACKAGE_NAME = 'github-issue-tower-defence-management';

const resolveRepositoryRootDirectory = (startDirectory: string): string => {
  let currentDirectory = startDirectory;
  while (true) {
    const packageJsonPath = path.join(currentDirectory, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJsonContent = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf8'),
      ) as { name?: string };
      if (packageJsonContent.name === REPOSITORY_PACKAGE_NAME) {
        return currentDirectory;
      }
    }
    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new Error(
        `could not find an ancestor of ${startDirectory} whose package.json name is "${REPOSITORY_PACKAGE_NAME}"`,
      );
    }
    currentDirectory = parentDirectory;
  }
};

const runNpxTypecheckCommand = (
  repositoryRootDirectory: string,
  typecheckTsconfigRelativePath: string,
): TypecheckRunResult => {
  const result = spawnSync(
    'npx',
    ['tsc', '--noEmit', '-p', typecheckTsconfigRelativePath],
    {
      cwd: repositoryRootDirectory,
      encoding: 'utf8',
    },
  );
  return {
    exitCode: result.status,
    combinedOutput: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
};

const buildRequiredPropFixtureComponentSource = (): string => `
import type { FC } from 'react';

export type TypecheckGuardFixtureButtonProps = {
  readonly label: string;
  readonly disabledReason: string;
};

export const TypecheckGuardFixtureButton: FC<
  TypecheckGuardFixtureButtonProps
> = ({ label, disabledReason }) => {
  return <button title={disabledReason}>{label}</button>;
};
`;

const buildFixtureTestSource = (includeRequiredProp: boolean): string => {
  const disabledReasonAttribute = includeRequiredProp
    ? ' disabledReason="saving in progress"'
    : '';
  return `
import { render } from '@testing-library/react';
import { TypecheckGuardFixtureButton } from './typecheckGuardFixtureComponent';

describe('TypecheckGuardFixtureButton', () => {
  it('renders the fixture button', () => {
    const { getByText } = render(
      <TypecheckGuardFixtureButton label="Save"${disabledReasonAttribute} />,
    );
    expect(getByText('Save')).toBeInTheDocument();
  });
});
`;
};

const createIsolatedTypecheckFixtureDirectory = (
  repositoryRootDirectory: string,
  includeRequiredProp: boolean,
): string => {
  const fixtureDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'console-ui-typecheck-guard-fixture-'),
  );
  const repositoryNodeModulesPath = path.join(
    repositoryRootDirectory,
    'node_modules',
  );
  fs.symlinkSync(
    repositoryNodeModulesPath,
    path.join(fixtureDirectory, 'node_modules'),
    'dir',
  );
  const realConsoleUiTsconfigPath = path.join(
    repositoryRootDirectory,
    'src',
    'adapter',
    'entry-points',
    'console',
    'ui',
    'tsconfig.json',
  );
  const realConsoleUiTsconfigContent = JSON.parse(
    fs.readFileSync(realConsoleUiTsconfigPath, 'utf8'),
  ) as { compilerOptions: Record<string, unknown> };
  const fixtureTsconfig = {
    compilerOptions: realConsoleUiTsconfigContent.compilerOptions,
    include: ['.'],
  };
  fs.writeFileSync(
    path.join(fixtureDirectory, 'tsconfig.json'),
    JSON.stringify(fixtureTsconfig, null, 2),
  );
  fs.writeFileSync(
    path.join(fixtureDirectory, 'typecheckGuardFixtureComponent.tsx'),
    buildRequiredPropFixtureComponentSource(),
  );
  fs.writeFileSync(
    path.join(fixtureDirectory, 'typecheckGuardFixtureComponent.test.tsx'),
    buildFixtureTestSource(includeRequiredProp),
  );
  return fixtureDirectory;
};

const runFixtureTypecheck = (
  repositoryRootDirectory: string,
  fixtureDirectory: string,
): TypecheckRunResult => {
  const tscBinaryPath = path.join(
    repositoryRootDirectory,
    'node_modules',
    '.bin',
    'tsc',
  );
  const result = spawnSync(
    tscBinaryPath,
    ['--noEmit', '-p', path.join(fixtureDirectory, 'tsconfig.json')],
    {
      cwd: fixtureDirectory,
      encoding: 'utf8',
    },
  );
  return {
    exitCode: result.status,
    combinedOutput: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
};

describe('console-ui typecheck guard', () => {
  const repositoryRootDirectory = resolveRepositoryRootDirectory(__dirname);

  it(
    'exits 0 for the contracted console-ui:typecheck command against the current repository tree',
    () => {
      const result = runNpxTypecheckCommand(
        repositoryRootDirectory,
        path.join(
          'src',
          'adapter',
          'entry-points',
          'console',
          'ui',
          'tsconfig.typecheck.json',
        ),
      );
      expect(result.exitCode).toBe(0);
    },
    60000,
  );

  describe.each([
    {
      caseName: 'a fixture test file omitting a required component prop',
      includeRequiredProp: false,
      expectedExitCode: 2,
    },
    {
      caseName:
        'a fixture test file supplying every required component prop',
      includeRequiredProp: true,
      expectedExitCode: 0,
    },
  ])('$caseName', ({ includeRequiredProp, expectedExitCode }) => {
    it(
      'reports the expected tsc --noEmit outcome for the fixture',
      () => {
        const fixtureDirectory = createIsolatedTypecheckFixtureDirectory(
          repositoryRootDirectory,
          includeRequiredProp,
        );
        try {
          const result = runFixtureTypecheck(
            repositoryRootDirectory,
            fixtureDirectory,
          );
          expect(result.exitCode).toBe(expectedExitCode);
          if (includeRequiredProp) {
            expect(result.combinedOutput.trim()).toBe('');
          } else {
            expect(result.combinedOutput).toContain('TS2741');
            expect(result.combinedOutput).toContain('disabledReason');
          }
        } finally {
          fs.rmSync(fixtureDirectory, { recursive: true, force: true });
        }
      },
      60000,
    );
  });
});
