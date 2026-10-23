import { spawnSync } from 'child_process';
import * as path from 'path';

const repositoryRoot = path.resolve(__dirname, '..');

const hasLintScript = (
  value: unknown,
): value is { readonly ['scripts.lint']?: unknown } =>
  typeof value === 'object' && value !== null && 'scripts.lint' in value;

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

    const packageScriptResult: unknown = JSON.parse(result.stdout);
    if (!hasLintScript(packageScriptResult)) {
      throw new Error('npm pkg get did not return scripts.lint');
    }

    const lintCommand = packageScriptResult['scripts.lint'];
    if (typeof lintCommand !== 'string') {
      throw new Error('scripts.lint is not a string');
    }

    expect(lintCommand).toContain(
      'node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src',
    );
  });
});
