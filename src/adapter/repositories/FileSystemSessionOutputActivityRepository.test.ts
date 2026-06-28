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

  it('returns the latest entry timestamp of any type as the last activity epoch', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantEntry('2026-06-27T10:00:00.000Z'),
      userEntry('2026-06-27T10:30:00.000Z'),
      assistantEntry('2026-06-27T10:05:00.000Z'),
    ]);
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(
      new Map([['workbench', transcriptPath]]),
    );

    expect(result).toEqual([
      {
        sessionName: 'workbench',
        lastOutputEpochSeconds: Math.floor(
          Date.parse('2026-06-27T10:30:00.000Z') / 1000,
        ),
      },
    ]);
  });

  it('advances the last activity time when a later user entry follows an assistant entry', async () => {
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
          Date.parse('2026-06-27T11:00:00.000Z') / 1000,
        ),
      },
    ]);
  });

  it('advances the last activity time when a tool_result entry is the latest entry', async () => {
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
          Date.parse('2026-06-27T10:45:00.000Z') / 1000,
        ),
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
      },
    ]);
  });

  it('resolves a transcript whose only entry is a non-assistant entry', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      userEntry('2026-06-27T10:00:00.000Z'),
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
      },
    ]);
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

  it('returns an empty list when no sessions are requested', async () => {
    const repository = new FileSystemSessionOutputActivityRepository();

    const result = await repository.listSessionOutputActivities(new Map());

    expect(result).toEqual([]);
  });
});
