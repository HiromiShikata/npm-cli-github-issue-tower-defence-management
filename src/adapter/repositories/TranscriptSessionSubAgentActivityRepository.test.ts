import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SubAgentTranscriptDirectoryResolver } from '../../domain/usecases/adapter-interfaces/SubAgentTranscriptDirectoryResolver';
import { FileSystemSubAgentTranscriptDirectoryResolver } from './FileSystemSubAgentTranscriptDirectoryResolver';
import { TranscriptSessionSubAgentActivityRepository } from './TranscriptSessionSubAgentActivityRepository';

describe('TranscriptSessionSubAgentActivityRepository', () => {
  let rootDirectory: string;
  const now = new Date('2026-06-27T12:00:00.000Z');
  const nowEpochSeconds = Math.floor(now.getTime() / 1000);
  const noOpCeilingSeconds = 365 * 24 * 60 * 60;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-tx-'));
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { force: true, recursive: true });
  });

  const cwdSlugFor = (sessionName: string): string =>
    `-home-user-worktrees-${sessionName.replace(/[^a-zA-Z0-9]/g, '-')}`;

  const sessionUuidFor = (sessionName: string): string =>
    `uuid-${sessionName.replace(/[^a-zA-Z0-9]/g, '-')}`;

  const mainTranscriptPathFor = (sessionName: string): string =>
    path.join(
      rootDirectory,
      cwdSlugFor(sessionName),
      `${sessionUuidFor(sessionName)}.jsonl`,
    );

  const transcriptMapFor = (sessionNames: string[]): Map<string, string> =>
    new Map(
      sessionNames.map((sessionName) => [
        sessionName,
        mainTranscriptPathFor(sessionName),
      ]),
    );

  const subAgentsDirFor = (sessionName: string): string => {
    const dir = path.join(
      rootDirectory,
      cwdSlugFor(sessionName),
      sessionUuidFor(sessionName),
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

  const createResolver = (): SubAgentTranscriptDirectoryResolver =>
    new FileSystemSubAgentTranscriptDirectoryResolver(rootDirectory);

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

  const stopSequenceFinishedEntries = (startTimestamp: string): object[] => [
    { type: 'user', timestamp: startTimestamp, message: { role: 'user' } },
    {
      type: 'assistant',
      timestamp: startTimestamp,
      message: { role: 'assistant', stop_reason: 'stop_sequence' },
    },
  ];

  const finalTextAnswerEntries = (startTimestamp: string): object[] => [
    { type: 'user', timestamp: startTimestamp, message: { role: 'user' } },
    {
      type: 'assistant',
      timestamp: startTimestamp,
      message: {
        role: 'assistant',
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', name: 'Bash', input: {} }],
      },
    },
    {
      type: 'user',
      timestamp: startTimestamp,
      message: {
        role: 'user',
        content: [{ type: 'tool_result', content: '' }],
      },
    },
    {
      type: 'assistant',
      timestamp: startTimestamp,
      message: {
        role: 'assistant',
        stop_reason: null,
        content: [{ type: 'text', text: 'All verification complete.' }],
      },
    },
  ];

  const interruptedEntries = (startTimestamp: string): object[] => [
    { type: 'user', timestamp: startTimestamp, message: { role: 'user' } },
    {
      type: 'assistant',
      timestamp: startTimestamp,
      message: {
        role: 'assistant',
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', name: 'Bash', input: {} }],
      },
    },
    {
      type: 'user',
      timestamp: startTimestamp,
      message: {
        role: 'user',
        content: [{ type: 'text', text: '[Request interrupted by user]' }],
      },
    },
  ];

  const pendingToolUseEntries = (startTimestamp: string): object[] => [
    { type: 'user', timestamp: startTimestamp, message: { role: 'user' } },
    {
      type: 'user',
      timestamp: startTimestamp,
      message: {
        role: 'user',
        content: [{ type: 'tool_result', content: '' }],
      },
    },
    {
      type: 'assistant',
      timestamp: startTimestamp,
      message: {
        role: 'assistant',
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', name: 'Bash', input: {} }],
      },
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
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

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
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.size).toBe(0);
  });

  it('excludes a finished sub-agent whose last entry stop_reason is stop_sequence', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeAgentTranscript(
      sessionName,
      'done2',
      stopSequenceFinishedEntries('2026-06-27T11:00:00.000Z'),
      nowEpochSeconds - 30,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.size).toBe(0);
  });

  it('excludes a finished sub-agent whose last entry is a final assistant text answer with a null stop_reason', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeAgentTranscript(
      sessionName,
      'finaltext',
      finalTextAnswerEntries('2026-06-27T11:00:00.000Z'),
      nowEpochSeconds - 600,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.size).toBe(0);
  });

  it('excludes a sub-agent whose transcript ends with a user interruption text entry', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeAgentTranscript(
      sessionName,
      'interrupted',
      interruptedEntries('2026-06-27T11:00:00.000Z'),
      nowEpochSeconds - 600,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.size).toBe(0);
  });

  it('flags a genuinely-active sub-agent whose last entry is a pending tool call', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeAgentTranscript(
      sessionName,
      'pending',
      pendingToolUseEntries('2026-06-27T11:45:00.000Z'),
      nowEpochSeconds - 600,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      { label: 'agent-pending', silentSeconds: 600, runningSeconds: 900 },
    ]);
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
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      { label: 'agent-link1', silentSeconds: 60, runningSeconds: 600 },
    ]);
    fs.rmSync(targetDir, { force: true, recursive: true });
  });

  it('returns an empty map when the resolver returns null', async () => {
    const repository = new TranscriptSessionSubAgentActivityRepository(
      { resolveSubAgentsDirectory: () => null },
      now,
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      ['https_//github_com/owner/repo/issues/9'],
      transcriptMapFor(['https_//github_com/owner/repo/issues/9']),
    );

    expect(result.size).toBe(0);
  });

  it('ignores a session whose subagents directory does not exist', async () => {
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      ['https_//github_com/owner/repo/issues/404'],
      transcriptMapFor(['https_//github_com/owner/repo/issues/404']),
    );

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
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

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
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      { label: 'agent-future', silentSeconds: 0, runningSeconds: 0 },
    ]);
  });

  it('resolves sub-agent transcripts laid out exactly as Claude Code stores them on disk', async () => {
    const sessionName = 'https_//github_com/HiromiShikata/repo/issues/2355';
    const projectsRoot = path.join(rootDirectory, 'projects');
    const cwdSlug =
      '-home-user-0-workspaces-workspace1-oss-example-repo-worktrees-i2355';
    const sessionUuid = 'ba0637e1-9ff1-41a8-b13c-f45e6a71efc5';
    const mainTranscriptPath = path.join(
      projectsRoot,
      cwdSlug,
      `${sessionUuid}.jsonl`,
    );
    const subagentsDir = path.join(
      projectsRoot,
      cwdSlug,
      sessionUuid,
      'subagents',
    );
    fs.mkdirSync(subagentsDir, { recursive: true });
    fs.mkdirSync(path.dirname(mainTranscriptPath), { recursive: true });
    fs.writeFileSync(mainTranscriptPath, '', 'utf8');
    const agentFile = path.join(subagentsDir, 'agent-afcbe335fdbec0a28.jsonl');
    fs.writeFileSync(
      agentFile,
      runningEntries('2026-06-27T11:45:00.000Z')
        .map((entry) => JSON.stringify(entry))
        .join('\n'),
      'utf8',
    );
    fs.utimesSync(agentFile, nowEpochSeconds - 120, nowEpochSeconds - 120);

    const repository = new TranscriptSessionSubAgentActivityRepository(
      new FileSystemSubAgentTranscriptDirectoryResolver(projectsRoot),
      now,
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      new Map([[sessionName, mainTranscriptPath]]),
    );

    expect(result.get(sessionName)).toEqual([
      {
        label: 'agent-afcbe335fdbec0a28',
        silentSeconds: 120,
        runningSeconds: 900,
      },
    ]);
  });

  it('excludes a long-dead sub-agent whose transcript has been silent beyond the ceiling', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    const twoDaysSeconds = 2 * 24 * 60 * 60;
    writeAgentTranscript(
      sessionName,
      'deadone',
      runningEntries('2026-06-25T11:45:00.000Z'),
      nowEpochSeconds - twoDaysSeconds,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      60 * 60,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.size).toBe(0);
  });

  it('keeps a recently-silent sub-agent whose transcript is within the ceiling', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeAgentTranscript(
      sessionName,
      'aliveone',
      runningEntries('2026-06-27T11:45:00.000Z'),
      nowEpochSeconds - 360,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      60 * 60,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      { label: 'agent-aliveone', silentSeconds: 360, runningSeconds: 900 },
    ]);
  });

  it('keeps a sub-agent silent exactly at the ceiling and excludes one past it', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeAgentTranscript(
      sessionName,
      'atceiling',
      runningEntries('2026-06-27T11:00:00.000Z'),
      nowEpochSeconds - 3600,
    );
    writeAgentTranscript(
      sessionName,
      'pastceiling',
      runningEntries('2026-06-27T11:00:00.000Z'),
      nowEpochSeconds - 3601,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      3600,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      { label: 'agent-atceiling', silentSeconds: 3600, runningSeconds: 3600 },
    ]);
  });

  it('flags only the recently-silent sub-agent when a session holds both a dead and an alive transcript', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    const twoDaysSeconds = 2 * 24 * 60 * 60;
    writeAgentTranscript(
      sessionName,
      'deadtwo',
      runningEntries('2026-06-25T11:00:00.000Z'),
      nowEpochSeconds - twoDaysSeconds,
    );
    writeAgentTranscript(
      sessionName,
      'alivetwo',
      runningEntries('2026-06-27T11:45:00.000Z'),
      nowEpochSeconds - 400,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      60 * 60,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      { label: 'agent-alivetwo', silentSeconds: 400, runningSeconds: 900 },
    ]);
  });

  const writeMainTranscript = (
    sessionName: string,
    lines: object[],
  ): void => {
    const filePath = mainTranscriptPathFor(sessionName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'utf8',
    );
  };

  const killedNotificationEntry = (
    agentId: string,
    timestamp: string,
  ): object => ({
    type: 'queue-operation',
    operation: 'enqueue',
    timestamp,
    content: `<task-notification>\n<task-id>${agentId}</task-id>\n<status>killed</status>\n</task-notification>`,
  });

  const failedNotificationEntry = (
    agentId: string,
    timestamp: string,
  ): object => ({
    type: 'queue-operation',
    operation: 'enqueue',
    timestamp,
    content: `<task-notification>\n<task-id>${agentId}</task-id>\n<status>failed</status>\n</task-notification>`,
  });

  const completedNotificationEntry = (
    agentId: string,
    timestamp: string,
  ): object => ({
    type: 'queue-operation',
    operation: 'enqueue',
    timestamp,
    content: `<task-notification>\n<task-id>${agentId}</task-id>\n<status>completed</status>\n</task-notification>`,
  });

  it('excludes a sub-agent killed via TaskStop when the parent transcript records a killed notification for its id', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    const killedAgentId = 'aaabbbbcccc00001';
    writeAgentTranscript(
      sessionName,
      killedAgentId,
      pendingToolUseEntries('2026-06-27T11:00:00.000Z'),
      nowEpochSeconds - 300,
    );
    writeMainTranscript(sessionName, [
      killedNotificationEntry(killedAgentId, '2026-06-27T11:55:00.000Z'),
    ]);
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.size).toBe(0);
  });

  it('excludes a sub-agent whose process crashed when the parent transcript records a failed notification for its id', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    const failedAgentId = 'aaabbbbcccc00002';
    writeAgentTranscript(
      sessionName,
      failedAgentId,
      pendingToolUseEntries('2026-06-27T11:00:00.000Z'),
      nowEpochSeconds - 300,
    );
    writeMainTranscript(sessionName, [
      failedNotificationEntry(failedAgentId, '2026-06-27T11:55:00.000Z'),
    ]);
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.size).toBe(0);
  });

  it('does not exclude a sub-agent whose parent transcript records only a completed notification for its id', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    const startTimestamp = '2026-06-27T11:45:00.000Z';
    const completedAgentId = 'aaabbbbcccc00003';
    writeAgentTranscript(
      sessionName,
      completedAgentId,
      pendingToolUseEntries(startTimestamp),
      nowEpochSeconds - 120,
    );
    writeMainTranscript(sessionName, [
      completedNotificationEntry(completedAgentId, '2026-06-27T11:58:00.000Z'),
    ]);
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      {
        label: `agent-${completedAgentId}`,
        silentSeconds: 120,
        runningSeconds: 900,
      },
    ]);
  });

  it('excludes a killed sub-agent but reports a still-active sibling in the same session', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    const killedAgentId = 'aaabbbbcccc00004';
    const aliveAgentId = 'aaabbbbcccc00005';
    writeAgentTranscript(
      sessionName,
      killedAgentId,
      pendingToolUseEntries('2026-06-27T11:00:00.000Z'),
      nowEpochSeconds - 600,
    );
    writeAgentTranscript(
      sessionName,
      aliveAgentId,
      runningEntries('2026-06-27T11:45:00.000Z'),
      nowEpochSeconds - 120,
    );
    writeMainTranscript(sessionName, [
      killedNotificationEntry(killedAgentId, '2026-06-27T11:55:00.000Z'),
    ]);
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      {
        label: `agent-${aliveAgentId}`,
        silentSeconds: 120,
        runningSeconds: 900,
      },
    ]);
  });

  it('reports a sub-agent even when the parent transcript path does not exist', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    const startTimestamp = '2026-06-27T11:45:00.000Z';
    writeAgentTranscript(
      sessionName,
      'aabb1122cc3344ee',
      runningEntries(startTimestamp),
      nowEpochSeconds - 120,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      now,
      noOpCeilingSeconds,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      { label: 'agent-aabb1122cc3344ee', silentSeconds: 120, runningSeconds: 900 },
    ]);
  });
});
