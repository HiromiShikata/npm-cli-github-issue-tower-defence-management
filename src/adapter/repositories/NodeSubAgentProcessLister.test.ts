import { NodeSubAgentProcessLister } from './NodeSubAgentProcessLister';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createRunner = (
  stdout: string,
  exitCode = 0,
): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn().mockResolvedValue({ stdout, stderr: '', exitCode }),
});

describe('NodeSubAgentProcessLister', () => {
  it('parses elapsed seconds and command line from ps output', async () => {
    const runner = createRunner(
      '  1200 worker session=s1 label=task-a\n   30 another --flag value\n',
    );
    const lister = new NodeSubAgentProcessLister(runner);
    const processes = await lister.listProcesses();
    expect(processes).toEqual([
      { commandLine: 'worker session=s1 label=task-a', elapsedSeconds: 1200 },
      { commandLine: 'another --flag value', elapsedSeconds: 30 },
    ]);
    expect(runner.runCommand.mock.calls[0]).toEqual([
      'ps',
      ['-eo', 'etimes=,args='],
    ]);
  });

  it('returns an empty array when ps exits non-zero', async () => {
    const runner = createRunner('', 1);
    const lister = new NodeSubAgentProcessLister(runner);
    expect(await lister.listProcesses()).toEqual([]);
  });

  it('skips blank lines and lines without a command', async () => {
    const runner = createRunner('\n  1200 \n  500 valid command\n');
    const lister = new NodeSubAgentProcessLister(runner);
    expect(await lister.listProcesses()).toEqual([
      { commandLine: 'valid command', elapsedSeconds: 500 },
    ]);
  });
});
