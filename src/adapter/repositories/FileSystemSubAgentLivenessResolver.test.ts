import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SubAgentProcessLister } from '../../domain/usecases/adapter-interfaces/SubAgentProcessLister';
import { FileSystemSubAgentLivenessResolver } from './FileSystemSubAgentLivenessResolver';
import { FileSystemSubAgentTranscriptDirectoryResolver } from './FileSystemSubAgentTranscriptDirectoryResolver';
import { TranscriptSessionSubAgentActivityRepository } from './TranscriptSessionSubAgentActivityRepository';

describe('FileSystemSubAgentLivenessResolver', () => {
  let runtimeRoot: string;
  const cwdSlug = '-home-user-worktrees-issue-9';
  const sessionUuid = 'ba0637e1-9ff1-41a8-b13c-f45e6a71efc5';
  const sessionName = 'https_//github_com/owner/repo/issues/9';
  const mainTranscriptPath = path.join(
    '/home/user/.config/projects',
    cwdSlug,
    `${sessionUuid}.jsonl`,
  );

  beforeEach(() => {
    runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-live-'));
  });

  afterEach(() => {
    fs.rmSync(runtimeRoot, { force: true, recursive: true });
  });

  const writeRunningFile = (contents: string): void => {
    const dir = path.join(runtimeRoot, cwdSlug, sessionUuid);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'running-subagents.txt'), contents, 'utf8');
  };

  it('returns the trimmed non-empty ids listed in running-subagents.txt', async () => {
    writeRunningFile('a70a08e0587d6f484\n\n  ad5d15d239d7e72e8  \n');
    const resolver = new FileSystemSubAgentLivenessResolver(runtimeRoot);

    const result = await resolver.resolveLiveSubAgentIds({
      sessionName,
      mainTranscriptPath,
    });

    expect(result).toEqual(new Set(['a70a08e0587d6f484', 'ad5d15d239d7e72e8']));
  });

  it('returns only the leading agent id token of each record line', async () => {
    writeRunningFile(
      'ad3d5702d1339492e impl:redcircle-only-tag-format (no branch)\naf19c02b4c3a5d6e7 chore:board-sync i1300-record-parsing\n',
    );
    const resolver = new FileSystemSubAgentLivenessResolver(runtimeRoot);

    const result = await resolver.resolveLiveSubAgentIds({
      sessionName,
      mainTranscriptPath,
    });

    expect(result).toEqual(new Set(['ad3d5702d1339492e', 'af19c02b4c3a5d6e7']));
  });

  it('returns an empty set when the running file exists but lists no ids', async () => {
    writeRunningFile('\n   \n');
    const resolver = new FileSystemSubAgentLivenessResolver(runtimeRoot);

    const result = await resolver.resolveLiveSubAgentIds({
      sessionName,
      mainTranscriptPath,
    });

    expect(result).toEqual(new Set());
  });

  it('returns null when the runtime root exists and the session has no running file', async () => {
    const resolver = new FileSystemSubAgentLivenessResolver(runtimeRoot);

    const result = await resolver.resolveLiveSubAgentIds({
      sessionName,
      mainTranscriptPath,
    });

    expect(result).toBeNull();
  });

  it('returns null when the configured runtime root directory does not exist', async () => {
    const resolver = new FileSystemSubAgentLivenessResolver(
      path.join(runtimeRoot, 'absent-runtime-root'),
    );

    const result = await resolver.resolveLiveSubAgentIds({
      sessionName,
      mainTranscriptPath,
    });

    expect(result).toBeNull();
  });

  it('returns null when the runtime root directory is null', async () => {
    const resolver = new FileSystemSubAgentLivenessResolver(null);

    const result = await resolver.resolveLiveSubAgentIds({
      sessionName,
      mainTranscriptPath,
    });

    expect(result).toBeNull();
  });

  it('returns null when the main transcript path is null', async () => {
    const resolver = new FileSystemSubAgentLivenessResolver(runtimeRoot);

    const result = await resolver.resolveLiveSubAgentIds({
      sessionName,
      mainTranscriptPath: null,
    });

    expect(result).toBeNull();
  });
});

describe('running-subagents record agent id contract with TranscriptSessionSubAgentActivityRepository', () => {
  const cwdSlug = '-home-user-worktrees-issue-1300';
  const sessionUuid = 'c0f1a2b3-4d5e-6f70-8192-a3b4c5d6e7f8';
  const sessionName = 'https_//github_com/owner/repo/issues/1300';
  const liveAgentId = 'ad3d5702d1339492e';
  const now = new Date('2026-07-28T12:00:00.000Z');
  const emptyProcessLister: SubAgentProcessLister = {
    listProcesses: async () => [],
  };
  let runtimeRoot: string;
  let transcriptRoot: string;
  let mainTranscriptPath: string;

  beforeEach(() => {
    runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-live-rt-'));
    transcriptRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'subagent-live-tx-'),
    );
    mainTranscriptPath = path.join(
      transcriptRoot,
      cwdSlug,
      `${sessionUuid}.jsonl`,
    );
    fs.mkdirSync(path.dirname(mainTranscriptPath), { recursive: true });
    fs.writeFileSync(mainTranscriptPath, '', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(runtimeRoot, { force: true, recursive: true });
    fs.rmSync(transcriptRoot, { force: true, recursive: true });
  });

  it('keeps a sub-agent whose id is recorded together with its label on one line', async () => {
    const runningDirectory = path.join(runtimeRoot, cwdSlug, sessionUuid);
    fs.mkdirSync(runningDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(runningDirectory, 'running-subagents.txt'),
      `${liveAgentId} impl:subagent-liveness-record-parsing (no branch)\n`,
      'utf8',
    );
    const subAgentsDirectory = path.join(
      transcriptRoot,
      cwdSlug,
      sessionUuid,
      'subagents',
    );
    fs.mkdirSync(subAgentsDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(subAgentsDirectory, `agent-${liveAgentId}.jsonl`),
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-07-28T11:00:00.000Z',
        message: {
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', name: 'Read', input: {} }],
        },
      }),
      'utf8',
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      new FileSystemSubAgentTranscriptDirectoryResolver(transcriptRoot),
      emptyProcessLister,
      now,
      new FileSystemSubAgentLivenessResolver(runtimeRoot),
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      new Map([[sessionName, mainTranscriptPath]]),
    );

    expect(result.get(sessionName)?.map((activity) => activity.label)).toEqual([
      `agent-${liveAgentId}`,
    ]);
  });

  it('detects a working sub-agent when the runtime root exists and the session has no running-subagents record', async () => {
    const subAgentsDirectory = path.join(
      transcriptRoot,
      cwdSlug,
      sessionUuid,
      'subagents',
    );
    fs.mkdirSync(subAgentsDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(subAgentsDirectory, `agent-${liveAgentId}.jsonl`),
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-07-20T11:00:00.000Z',
        message: {
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', name: 'Read', input: {} }],
        },
      }),
      'utf8',
    );
    const repository = new TranscriptSessionSubAgentActivityRepository(
      new FileSystemSubAgentTranscriptDirectoryResolver(transcriptRoot),
      emptyProcessLister,
      now,
      new FileSystemSubAgentLivenessResolver(runtimeRoot),
    );

    const result = await repository.listSubAgentActivitiesBySessionName(
      [sessionName],
      new Map([[sessionName, mainTranscriptPath]]),
    );

    expect(result.get(sessionName)).toEqual([
      {
        label: `agent-${liveAgentId}`,
        silentSeconds: 0,
        runningSeconds: 694800,
        waitingOnExternalProcess: false,
        finishedResultUnconsumed: false,
      },
    ]);
  });
});
