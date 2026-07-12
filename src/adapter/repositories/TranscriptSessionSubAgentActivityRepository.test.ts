import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SubAgentTranscriptDirectoryResolver } from '../../domain/usecases/adapter-interfaces/SubAgentTranscriptDirectoryResolver';
import {
  SubAgentProcess,
  SubAgentProcessLister,
} from '../../domain/usecases/adapter-interfaces/SubAgentProcessLister';
import { FileSystemSubAgentTranscriptDirectoryResolver } from './FileSystemSubAgentTranscriptDirectoryResolver';
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

  const processListerWith = (
    processes: SubAgentProcess[],
  ): SubAgentProcessLister => ({
    listProcesses: async () => processes,
  });

  const emptyProcessLister = (): SubAgentProcessLister => processListerWith([]);

  const runningEntries = (startTimestamp: string): object[] => [
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

  const toolResultTerminalEntries = (startTimestamp: string): object[] => [
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
        content: [{ type: 'tool_result', content: 'command output' }],
      },
    },
  ];

  const structuredOutputTerminalEntries = (
    startTimestamp: string,
  ): object[] => [
    { type: 'user', timestamp: startTimestamp, message: { role: 'user' } },
    {
      type: 'assistant',
      timestamp: startTimestamp,
      message: {
        role: 'assistant',
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', name: 'StructuredOutput', input: {} }],
      },
    },
    {
      type: 'user',
      timestamp: startTimestamp,
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            content: 'Structured output provided successfully',
          },
        ],
      },
    },
  ];

  const emptyUserTerminalEntries = (startTimestamp: string): object[] => [
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
      message: { role: 'user', content: [] },
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
      emptyProcessLister(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      {
        label: 'agent-aaa111',
        silentSeconds: 120,
        runningSeconds: 900,
        waitingOnExternalProcess: false,
      },
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
      emptyProcessLister(),
      now,
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
      emptyProcessLister(),
      now,
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
      emptyProcessLister(),
      now,
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
      emptyProcessLister(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.size).toBe(0);
  });

  it('excludes a dead sub-agent whose transcript ends with an unconsumed tool result and no following assistant turn', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeAgentTranscript(
      sessionName,
      'toolresultend',
      toolResultTerminalEntries('2026-06-27T11:00:00.000Z'),
      nowEpochSeconds - 600,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      emptyProcessLister(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.size).toBe(0);
  });

  it('excludes a finished sub-agent whose transcript ends with the final StructuredOutput tool result', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeAgentTranscript(
      sessionName,
      'structuredend',
      structuredOutputTerminalEntries('2026-06-27T11:00:00.000Z'),
      nowEpochSeconds - 600,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      emptyProcessLister(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.size).toBe(0);
  });

  it('excludes a dead sub-agent whose transcript ends with a user entry that has no content blocks', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeAgentTranscript(
      sessionName,
      'emptyuserend',
      emptyUserTerminalEntries('2026-06-27T11:00:00.000Z'),
      nowEpochSeconds - 600,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      emptyProcessLister(),
      now,
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
      emptyProcessLister(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      {
        label: 'agent-pending',
        silentSeconds: 600,
        runningSeconds: 900,
        waitingOnExternalProcess: false,
      },
    ]);
  });

  it('flags a long-silent genuine stall whose last entry is a pending tool call regardless of how old it is', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    const fourDaysSeconds = 4 * 24 * 60 * 60;
    writeAgentTranscript(
      sessionName,
      'longstall',
      pendingToolUseEntries('2026-06-23T12:00:00.000Z'),
      nowEpochSeconds - fourDaysSeconds,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      emptyProcessLister(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      {
        label: 'agent-longstall',
        silentSeconds: fourDaysSeconds,
        runningSeconds: fourDaysSeconds,
        waitingOnExternalProcess: false,
      },
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
      emptyProcessLister(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      {
        label: 'agent-link1',
        silentSeconds: 60,
        runningSeconds: 600,
        waitingOnExternalProcess: false,
      },
    ]);
    fs.rmSync(targetDir, { force: true, recursive: true });
  });

  it('returns an empty map when the resolver returns null', async () => {
    const repository = new TranscriptSessionSubAgentActivityRepository(
      { resolveSubAgentsDirectory: () => null },
      emptyProcessLister(),
      now,
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
      emptyProcessLister(),
      now,
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
      emptyProcessLister(),
      now,
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
      emptyProcessLister(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      {
        label: 'agent-future',
        silentSeconds: 0,
        runningSeconds: 0,
        waitingOnExternalProcess: false,
      },
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
      emptyProcessLister(),
      now,
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
        waitingOnExternalProcess: false,
      },
    ]);
  });

  it('flags a marker-less stall and excludes a finished transcript in the same session regardless of their age', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    const twoDaysSeconds = 2 * 24 * 60 * 60;
    writeAgentTranscript(
      sessionName,
      'finishedold',
      finishedEntries('2026-06-25T12:00:00.000Z'),
      nowEpochSeconds - twoDaysSeconds,
    );
    writeAgentTranscript(
      sessionName,
      'stalledold',
      pendingToolUseEntries('2026-06-25T12:00:00.000Z'),
      nowEpochSeconds - twoDaysSeconds,
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      createResolver(),
      emptyProcessLister(),
      now,
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      transcriptMapFor([sessionName]),
    );

    expect(result.get(sessionName)).toEqual([
      {
        label: 'agent-stalledold',
        silentSeconds: twoDaysSeconds,
        runningSeconds: twoDaysSeconds,
        waitingOnExternalProcess: false,
      },
    ]);
  });

  describe('external-wait classification from the pending tool command', () => {
    const CI_WATCH_COMMAND =
      'gh pr checks 123 --watch -i 60 -R owner/repo 2>&1 | tail -5';

    const pendingCommandEntries = (
      startTimestamp: string,
      command: string,
    ): object[] => [
      { type: 'user', timestamp: startTimestamp, message: { role: 'user' } },
      {
        type: 'assistant',
        timestamp: startTimestamp,
        message: {
          role: 'assistant',
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', name: 'Bash', input: { command } }],
        },
      },
    ];

    it('classifies a sub-agent as waiting when its pending tool command matches a live process', async () => {
      const sessionName = 'https_//github_com/owner/repo/issues/9';
      writeAgentTranscript(
        sessionName,
        'ciwait',
        pendingCommandEntries('2026-06-27T11:45:00.000Z', CI_WATCH_COMMAND),
        nowEpochSeconds - 600,
      );
      const repository = new TranscriptSessionSubAgentActivityRepository(
        createResolver(),
        processListerWith([
          {
            commandLine: `/bin/bash -c ${CI_WATCH_COMMAND}`,
            elapsedSeconds: 600,
          },
        ]),
        now,
      );

      const result = await repository.listSubAgentActivitiesBySessionName(
        [sessionName],
        transcriptMapFor([sessionName]),
      );

      expect(result.get(sessionName)).toEqual([
        {
          label: 'agent-ciwait',
          silentSeconds: 600,
          runningSeconds: 900,
          waitingOnExternalProcess: true,
        },
      ]);
    });

    it('classifies a sub-agent as hung when no live process matches its pending tool command', async () => {
      const sessionName = 'https_//github_com/owner/repo/issues/9';
      writeAgentTranscript(
        sessionName,
        'dead',
        pendingCommandEntries('2026-06-27T11:45:00.000Z', CI_WATCH_COMMAND),
        nowEpochSeconds - 600,
      );
      const repository = new TranscriptSessionSubAgentActivityRepository(
        createResolver(),
        processListerWith([
          { commandLine: 'node unrelated-server.js', elapsedSeconds: 5000 },
        ]),
        now,
      );

      const result = await repository.listSubAgentActivitiesBySessionName(
        [sessionName],
        transcriptMapFor([sessionName]),
      );

      expect(result.get(sessionName)).toEqual([
        {
          label: 'agent-dead',
          silentSeconds: 600,
          runningSeconds: 900,
          waitingOnExternalProcess: false,
        },
      ]);
    });

    it('classifies a sub-agent as hung when its pending tool call carries no command string', async () => {
      const sessionName = 'https_//github_com/owner/repo/issues/9';
      writeAgentTranscript(
        sessionName,
        'nocmd',
        pendingToolUseEntries('2026-06-27T11:45:00.000Z'),
        nowEpochSeconds - 600,
      );
      const repository = new TranscriptSessionSubAgentActivityRepository(
        createResolver(),
        processListerWith([
          { commandLine: 'any process at all', elapsedSeconds: 1 },
        ]),
        now,
      );

      const result = await repository.listSubAgentActivitiesBySessionName(
        [sessionName],
        transcriptMapFor([sessionName]),
      );

      expect(result.get(sessionName)?.[0]?.waitingOnExternalProcess).toBe(
        false,
      );
    });

    it('matches on the whitespace-normalized first 60 characters of a long multi-line command', async () => {
      const sessionName = 'https_//github_com/owner/repo/issues/9';
      const longCommand =
        'OWNER=owner; REPO=repo; PR=123\n  SHA=$(gh api repos/$OWNER/$REPO/pulls/$PR --jq .head.sha)\n  sleep 600';
      writeAgentTranscript(
        sessionName,
        'longcmd',
        pendingCommandEntries('2026-06-27T11:45:00.000Z', longCommand),
        nowEpochSeconds - 600,
      );
      const normalizedProcessLine =
        'bash -c OWNER=owner; REPO=repo; PR=123 SHA=$(gh api repos/$OWNER/$REPO/pulls/$PR --jq .head.sha) sleep 600';
      const repository = new TranscriptSessionSubAgentActivityRepository(
        createResolver(),
        processListerWith([
          { commandLine: normalizedProcessLine, elapsedSeconds: 600 },
        ]),
        now,
      );

      const result = await repository.listSubAgentActivitiesBySessionName(
        [sessionName],
        transcriptMapFor([sessionName]),
      );

      expect(result.get(sessionName)?.[0]?.waitingOnExternalProcess).toBe(true);
    });
  });
});
