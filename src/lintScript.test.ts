import { spawnSync } from 'child_process';
import * as path from 'path';

const repositoryRoot = path.resolve(__dirname, '..');

const readLintScriptWithoutNodeOptions = (): {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error: string;
} => {
  const environment = { ...process.env };
  delete environment.NODE_OPTIONS;

  const result = spawnSync('npm', ['pkg', 'get', 'scripts.lint', '--json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: environment,
    timeout: 10_000,
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message ?? '',
  };
};

describe('lint npm script', () => {
  it('declares a self-contained Node heap limit without external NODE_OPTIONS', () => {
    const result = readLintScriptWithoutNodeOptions();
    expect(result.status).toBe(0);

    const packageScriptResult = JSON.parse(result.stdout) as {
      readonly ['scripts.lint']?: unknown;
    };
    expect(packageScriptResult['scripts.lint']).toEqual(
      expect.stringContaining(
        'node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src',
      ),
    );
  });
});
