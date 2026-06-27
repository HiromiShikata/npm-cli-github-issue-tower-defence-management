import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SubAgentTranscriptDirectoryResolver } from '../../domain/usecases/adapter-interfaces/SubAgentTranscriptDirectoryResolver';
import { TranscriptSessionSubAgentActivityRepository } from './TranscriptSessionSubAgentActivityRepository';

describe('TranscriptSessionSubAgentActivityRepository', () => {
  let rootDirectory: string;
  const now = new Date('2026-06-27T12:00:00.000Z');
  const nowEpochSeconds = Math.floor(now.getTime() / 1000);

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-tx-'));
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { force: true, recursive: true });
  });

  const subAgentsDirFor = (sessionName: string): string => {
    const dir = path.join(
      rootDirectory,
      sessionName.replace(/\//g, '_'),
      'subagents',
    );
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  const writeAgentTranscript = (
    sessionName: string,
    agentId: string,
    entries: object[],
    mtimeEpochSeconds: number,
  ): string => {
    const dir = subAgentsDirFor(sessionName);
    const filePath = path.join(dir, `agent-${agentId}.jsonl`);
    fs.writeFileSync(
      filePath,
      entries.map((entry) => JSON.stringify(entry)).join('\n'),
      'utf8',
    );
    fs.utimesSync(filePath, mtimeEpochSeconds, mtimeEpochSeconds);
    return filePath;
  };

  const createResolver = (): SubAgentTranscriptDirectoryResolver => ({
    resolveSubAgentsDirectory: (sessionName) =>
      path.join(rootDirectory, sessionName.replace(/\//g, '_'), 'subagents'),
  });

  const runningEntries = (startTimestamp: string): object[] => [
    { type: 'user', timestamp: startTimestamp, message: { role: 'user' } },
    {
      type: 'assistant',
      timestamp: startTimestamp,
      message: { role: 'assistant', stop_reason: 'tool_use' },
    },
  ];

  const finishedEntries = (startTimestamp: string): object[] => [
    { type: 'user', timestamp: startTimestamp, message: { role: 'user' } },
    {
      type: 'assistant',
      timestamp: startTimestamp,
      message: { role: 'assistant', stop_reason: 'end_turn' },
    },
  ];

  it('reports a running sub-agent with silent seconds from the file mtime and running seconds from the first entry', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    const startTimestamp = '2026-06-27T11:45:00.000Z';
    writeAgentTranscript(
      sessionName,
      'aaa111',
      runningEntries(startTimestamp),
      nowEpochSeconds - 120,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName([
      sessionName,
    ]);

    expect(result.get(sessionName)).toEqual([
      { label: 'agent-aaa111', silentSeconds: 120, runningSeconds: 900 },
    ]);
  });

  it('excludes a finished sub-agent whose last entry stop_reason is end_turn', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeAgentTranscript(
      sessionName,
      'done1',
      finishedEntries('2026-06-27T11:00:00.000Z'),
      nowEpochSeconds - 30,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName([
      sessionName,
    ]);

    expect(result.size).toBe(0);
  });

  it('follows a symlinked transcript when computing silent seconds', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    const targetDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'subagent-target-'),
    );
    const targetPath = path.join(targetDir, 'real-agent.jsonl');
    fs.writeFileSync(
      targetPath,
      runningEntries('2026-06-27T11:50:00.000Z')
        .map((entry) => JSON.stringify(entry))
        .join('\n'),
      'utf8',
    );
    fs.utimesSync(targetPath, nowEpochSeconds - 60, nowEpochSeconds - 60);
    const dir = subAgentsDirFor(sessionName);
    fs.symlinkSync(targetPath, path.join(dir, 'agent-link1.jsonl'));
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName([
      sessionName,
    ]);

    expect(result.get(sessionName)).toEqual([
      { label: 'agent-link1', silentSeconds: 60, runningSeconds: 600 },
    ]);
    fs.rmSync(targetDir, { force: true, recursive: true });
  });

  it('returns an empty map when the resolver returns null', async () => {
    const repository = new TranscriptSessionSubAgentActivityRepository(
      { resolveSubAgentsDirectory: () => null },
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName([
      'https_//github_com/owner/repo/issues/9',
    ]);

    expect(result.size).toBe(0);
  });

  it('ignores a session whose subagents directory does not exist', async () => {
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName([
      'https_//github_com/owner/repo/issues/404',
    ]);

    expect(result.size).toBe(0);
  });

  it('groups multiple running sub-agents under the same session', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeAgentTranscript(
      sessionName,
      'one',
      runningEntries('2026-06-27T11:55:00.000Z'),
      nowEpochSeconds - 10,
    );
    writeAgentTranscript(
      sessionName,
      'two',
      runningEntries('2026-06-27T11:55:00.000Z'),
      nowEpochSeconds - 20,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName([
      sessionName,
    ]);

    expect(result.get(sessionName)).toHaveLength(2);
  });

  it('clamps negative silent and running seconds to zero', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeAgentTranscript(
      sessionName,
      'future',
      runningEntries('2026-06-27T13:00:00.000Z'),
      nowEpochSeconds + 100,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName([
      sessionName,
    ]);

    expect(result.get(sessionName)).toEqual([
      { label: 'agent-future', silentSeconds: 0, runningSeconds: 0 },
    ]);
  });
});
