import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemSessionOutputActivityRepository } from './FileSystemSessionOutputActivityRepository';

describe('FileSystemSessionOutputActivityRepository', () => {
  let rootDirectory: string;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'session-output-activity-'),
    );
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { force: true, recursive: true });
  });

  const assistantEntry = (timestamp: string): object => ({
    type: 'assistant',
    timestamp,
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'progress update' }],
    },
  });

  const assistantEntryWithoutTimestamp = (): object => ({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'no timestamp on this entry' }],
    },
  });

  const userEntry = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    message: { role: 'user', content: 'go ahead' },
  });

  const toolResultEntry = (timestamp: string): object => ({
    type: 'tool_result',
    timestamp,
    toolUseResult: { stdout: 'done', stderr: '' },
  });

  const systemEntry = (timestamp: string): object => ({
    type: 'system',
    timestamp,
    content: 'Compacting conversation history',
  });

  const assistantEntryWithToolUse = (
    timestamp: string,
    toolUseId: string,
  ): object => ({
    type: 'assistant',
    timestamp,
    message: {
      role: 'assistant',
      stop_reason: 'tool_use',
      content: [
        { type: 'text', text: 'running a command' },
        {
          type: 'tool_use',
          id: toolUseId,
          name: 'Bash',
          input: { command: 'sleep 590' },
        },
      ],
    },
  });

  const toolResultUserEntry = (
    timestamp: string,
    toolUseId: string,
  ): object => ({
    type: 'user',
    timestamp,
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: 'done',
        },
      ],
    },
  });

  const untimestampedEntry = (): object => ({
    type: 'summary',
    summary: 'no timestamp on this entry',
  });

  const writeTranscript = (fileName: string, lines: object[]): string => {
    const filePath = path.join(rootDirectory, fileName);
    fs.writeFileSync(
      filePath,
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'utf8',
    );
    return filePath;
  };

  it('returns the old last-assistant timestamp when recent system and tool entries follow it', async () => {
    const transcriptPath = writeTranscript('thrashing.jsonl', [
      assistantEntry('2026-06-27T01:00:00.000Z'),
      systemEntry('2026-06-27T09:30:00.000Z'),
      toolResultEntry('2026-06-27T09:45:00.000Z'),
      systemEntry('2026-06-27T10:00:00.000Z'),
    ]);
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(
      new Map([['thrashing', transcriptPath]]),
    );

    expect(result).toEqual([
      {
        sessionName: 'thrashing',
        lastOutputEpochSeconds: Math.floor(
          Date.parse('2026-06-27T01:00:00.000Z') / 1000,
        ),
        hasInProgressToolCall: false,
      },
    ]);
  });

  it('returns the recent timestamp when the latest assistant entry is recent', async () => {
    const transcriptPath = writeTranscript('working.jsonl', [
      userEntry('2026-06-27T09:00:00.000Z'),
      assistantEntry('2026-06-27T09:55:00.000Z'),
    ]);
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(
      new Map([['working', transcriptPath]]),
    );

    expect(result).toEqual([
      {
        sessionName: 'working',
        lastOutputEpochSeconds: Math.floor(
          Date.parse('2026-06-27T09:55:00.000Z') / 1000,
        ),
        hasInProgressToolCall: false,
      },
    ]);
  });

  it('ignores a later user entry and returns the last assistant timestamp', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantEntry('2026-06-27T10:00:00.000Z'),
      userEntry('2026-06-27T11:00:00.000Z'),
    ]);
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(
      new Map([['workbench', transcriptPath]]),
    );

    expect(result).toEqual([
      {
        sessionName: 'workbench',
        lastOutputEpochSeconds: Math.floor(
          Date.parse('2026-06-27T10:00:00.000Z') / 1000,
        ),
        hasInProgressToolCall: false,
      },
    ]);
  });

  it('ignores a later tool_result entry and returns the last assistant timestamp', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantEntry('2026-06-27T10:00:00.000Z'),
      toolResultEntry('2026-06-27T10:45:00.000Z'),
    ]);
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(
      new Map([['workbench', transcriptPath]]),
    );

    expect(result).toEqual([
      {
        sessionName: 'workbench',
        lastOutputEpochSeconds: Math.floor(
          Date.parse('2026-06-27T10:00:00.000Z') / 1000,
        ),
        hasInProgressToolCall: false,
      },
    ]);
  });

  it('returns the last assistant entry timestamp when several entry types interleave', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantEntry('2026-06-27T10:00:00.000Z'),
      userEntry('2026-06-27T10:10:00.000Z'),
      assistantEntry('2026-06-27T10:05:00.000Z'),
      systemEntry('2026-06-27T10:40:00.000Z'),
    ]);
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(
      new Map([['workbench', transcriptPath]]),
    );

    expect(result).toEqual([
      {
        sessionName: 'workbench',
        lastOutputEpochSeconds: Math.floor(
          Date.parse('2026-06-27T10:05:00.000Z') / 1000,
        ),
        hasInProgressToolCall: false,
      },
    ]);
  });

  it('falls back to the last assistant entry that has a parseable timestamp', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantEntry('2026-06-27T10:00:00.000Z'),
      assistantEntryWithoutTimestamp(),
    ]);
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(
      new Map([['workbench', transcriptPath]]),
    );

    expect(result).toEqual([
      {
        sessionName: 'workbench',
        lastOutputEpochSeconds: Math.floor(
          Date.parse('2026-06-27T10:00:00.000Z') / 1000,
        ),
        hasInProgressToolCall: false,
      },
    ]);
  });

  it('omits sessions whose transcript file is missing', async () => {
    const presentPath = writeTranscript('present.jsonl', [
      assistantEntry('2026-06-27T10:00:00.000Z'),
    ]);
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(
      new Map([
        ['present', presentPath],
        ['missing', path.join(rootDirectory, 'missing.jsonl')],
      ]),
    );

    expect(result).toEqual([
      {
        sessionName: 'present',
        lastOutputEpochSeconds: Math.floor(
          Date.parse('2026-06-27T10:00:00.000Z') / 1000,
        ),
        hasInProgressToolCall: false,
      },
    ]);
  });

  it('omits a transcript whose only entries are non-assistant entries', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      userEntry('2026-06-27T10:00:00.000Z'),
      toolResultEntry('2026-06-27T10:05:00.000Z'),
      systemEntry('2026-06-27T10:10:00.000Z'),
    ]);
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(
      new Map([['workbench', transcriptPath]]),
    );

    expect(result).toEqual([]);
  });

  it('omits sessions whose transcript has no parseable timestamp', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      untimestampedEntry(),
    ]);
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(
      new Map([['workbench', transcriptPath]]),
    );

    expect(result).toEqual([]);
  });

  it('flags a session as waiting on a running tool when the last assistant tool_use has no matching tool_result', async () => {
    const transcriptPath = writeTranscript('busy.jsonl', [
      assistantEntry('2026-06-27T09:00:00.000Z'),
      assistantEntryWithToolUse('2026-06-27T09:01:00.000Z', 'toolu_running'),
    ]);
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(
      new Map([['busy', transcriptPath]]),
    );

    expect(result).toEqual([
      {
        sessionName: 'busy',
        lastOutputEpochSeconds: Math.floor(
          Date.parse('2026-06-27T09:01:00.000Z') / 1000,
        ),
        hasInProgressToolCall: true,
      },
    ]);
  });

  it('does not flag a session once the matching tool_result for its last tool_use is appended', async () => {
    const transcriptPath = writeTranscript('completed.jsonl', [
      assistantEntryWithToolUse('2026-06-27T09:01:00.000Z', 'toolu_done'),
      toolResultUserEntry('2026-06-27T09:05:00.000Z', 'toolu_done'),
    ]);
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(
      new Map([['completed', transcriptPath]]),
    );

    expect(result).toEqual([
      {
        sessionName: 'completed',
        lastOutputEpochSeconds: Math.floor(
          Date.parse('2026-06-27T09:01:00.000Z') / 1000,
        ),
        hasInProgressToolCall: false,
      },
    ]);
  });

  it('returns an empty list when no sessions are requested', async () => {
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(new Map());

    expect(result).toEqual([]);
  });
});
