import { ProcessListSessionSubAgentActivityRepository } from './ProcessListSessionSubAgentActivityRepository';
import { SubAgentProcessLister } from '../../domain/usecases/adapter-interfaces/SubAgentProcessLister';
import { SubAgentSilentSecondsResolver } from '../../domain/usecases/adapter-interfaces/SubAgentSilentSecondsResolver';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createLister = (
  processes: { commandLine: string; elapsedSeconds: number }[],
): Mocked<SubAgentProcessLister> => ({
  listProcesses: jest.fn().mockResolvedValue(processes),
});

const createResolver = (
  silentSeconds: number,
): Mocked<SubAgentSilentSecondsResolver> => ({
  resolveSilentSeconds: jest.fn().mockReturnValue(silentSeconds),
});

describe('ProcessListSessionSubAgentActivityRepository', () => {
  it('returns an empty map when the match pattern is not configured', async () => {
    const repository = new ProcessListSessionSubAgentActivityRepository(
      null,
      createLister([
        { commandLine: 'anything session=s1', elapsedSeconds: 10 },
      ]),
      createResolver(0),
    );
    const result = await repository.listSubAgentActivitiesBySessionName(['s1']);
    expect(result.size).toBe(0);
  });

  it('returns an empty map when the match pattern is an empty string', async () => {
    const repository = new ProcessListSessionSubAgentActivityRepository(
      '',
      createLister([
        { commandLine: 'anything session=s1', elapsedSeconds: 10 },
      ]),
      createResolver(0),
    );
    const result = await repository.listSubAgentActivitiesBySessionName(['s1']);
    expect(result.size).toBe(0);
  });

  it('associates a matched process to a monitored session using the session capture group', async () => {
    const repository = new ProcessListSessionSubAgentActivityRepository(
      'session=(?<session>[^ ]+) label=(?<label>[^ ]+)',
      createLister([
        {
          commandLine: 'worker session=s1 label=task-a',
          elapsedSeconds: 1200,
        },
      ]),
      createResolver(180),
    );
    const result = await repository.listSubAgentActivitiesBySessionName(['s1']);
    expect(result.get('s1')).toEqual([
      {
        label: 'task-a',
        silentSeconds: 180,
        runningSeconds: 1200,
        waitingOnExternalProcess: false,
      },
    ]);
  });

  it('ignores processes whose captured session is not monitored', async () => {
    const repository = new ProcessListSessionSubAgentActivityRepository(
      'session=(?<session>[^ ]+)',
      createLister([
        { commandLine: 'worker session=other', elapsedSeconds: 1200 },
      ]),
      createResolver(0),
    );
    const result = await repository.listSubAgentActivitiesBySessionName(['s1']);
    expect(result.size).toBe(0);
  });

  it('falls back to the session name as the label when no label group is captured', async () => {
    const repository = new ProcessListSessionSubAgentActivityRepository(
      'session=(?<session>[^ ]+)',
      createLister([{ commandLine: 'worker session=s1', elapsedSeconds: 30 }]),
      createResolver(0),
    );
    const result = await repository.listSubAgentActivitiesBySessionName(['s1']);
    expect(result.get('s1')).toEqual([
      {
        label: 's1',
        silentSeconds: 0,
        runningSeconds: 30,
        waitingOnExternalProcess: false,
      },
    ]);
  });

  it('groups multiple matched processes under the same session', async () => {
    const repository = new ProcessListSessionSubAgentActivityRepository(
      'session=(?<session>[^ ]+) label=(?<label>[^ ]+)',
      createLister([
        { commandLine: 'worker session=s1 label=task-a', elapsedSeconds: 10 },
        { commandLine: 'worker session=s1 label=task-b', elapsedSeconds: 20 },
      ]),
      createResolver(0),
    );
    const result = await repository.listSubAgentActivitiesBySessionName(['s1']);
    expect(result.get('s1')).toHaveLength(2);
  });

  it('ignores processes that do not match the pattern', async () => {
    const repository = new ProcessListSessionSubAgentActivityRepository(
      'session=(?<session>[^ ]+)',
      createLister([
        { commandLine: 'unrelated process', elapsedSeconds: 1200 },
      ]),
      createResolver(0),
    );
    const result = await repository.listSubAgentActivitiesBySessionName(['s1']);
    expect(result.size).toBe(0);
  });
});
