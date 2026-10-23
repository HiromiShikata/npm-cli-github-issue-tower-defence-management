import * as fs from 'fs';
import { spawnSync } from 'child_process';
import * as os from 'os';
import * as path from 'path';

const repositoryRoot = path.resolve(__dirname, '..');

const runLintWithoutNodeOptions = (): {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error: string;
} => {
  const environment = { ...process.env };
  delete environment.NODE_OPTIONS;

  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'lint-script-test-'),
  );
  const stdoutPath = path.join(temporaryDirectory, 'stdout.txt');
  const stderrPath = path.join(temporaryDirectory, 'stderr.txt');
  let stdoutFileDescriptor: number | undefined;
  let stderrFileDescriptor: number | undefined;

  try {
    stdoutFileDescriptor = fs.openSync(stdoutPath, 'w');
    stderrFileDescriptor = fs.openSync(stderrPath, 'w');
    const result = spawnSync('npm', ['run', 'lint'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: environment,
      stdio: ['ignore', stdoutFileDescriptor, stderrFileDescriptor],
      timeout: 110_000,
    });

    return {
      status: result.status,
      stdout: fs.readFileSync(stdoutPath, 'utf8'),
      stderr: fs.readFileSync(stderrPath, 'utf8'),
      error: result.error?.message ?? '',
    };
  } finally {
    if (stdoutFileDescriptor !== undefined) {
      fs.closeSync(stdoutFileDescriptor);
    }
    if (stderrFileDescriptor !== undefined) {
      fs.closeSync(stderrFileDescriptor);
    }
    fs.unlinkSync(stdoutPath);
    fs.unlinkSync(stderrPath);
    fs.rmdirSync(temporaryDirectory);
  }
};

describe('lint npm script', () => {
  it('exits successfully without externally supplied NODE_OPTIONS', () => {
    const result = runLintWithoutNodeOptions();

    expect(result).toEqual(
      expect.objectContaining({
        status: 0,
      }),
    );
  }, 120_000);
});
