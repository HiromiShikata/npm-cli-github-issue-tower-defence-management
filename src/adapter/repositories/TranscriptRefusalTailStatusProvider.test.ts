import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TranscriptRefusalTailStatusProvider } from './TranscriptRefusalTailStatusProvider';

describe('TranscriptRefusalTailStatusProvider', () => {
  let rootDirectory: string;
  let provider: TranscriptRefusalTailStatusProvider;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'refusal-tail-status-'),
    );
    provider = new TranscriptRefusalTailStatusProvider();
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { force: true, recursive: true });
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

  const refusalSystemEntry = (timestamp: string): object => ({
    type: 'system',
    subtype: 'model_refusal_no_fallback',
    timestamp,
  });

  const refusalAssistantEntry = (timestamp: string): object => ({
    type: 'assistant',
    timestamp,
    message: {
      role: 'assistant',
      stop_reason: 'refusal',
      content: [],
    },
  });

  const normalAssistantEntry = (timestamp: string): object => ({
    type: 'assistant',
    timestamp,
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'progress update' }],
    },
  });

  const userEntry = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    promptSource: 'system',
    message: { role: 'user', content: 'injected reminder' },
  });

  it('reports a session whose transcript ends with a refusal assistant entry', async () => {
    const transcriptPath = writeTranscript('refusal-tail.jsonl', [
      normalAssistantEntry('2026-07-12T00:00:00Z'),
      userEntry('2026-07-12T00:10:00Z'),
      refusalSystemEntry('2026-07-12T00:10:05Z'),
      refusalAssistantEntry('2026-07-12T00:10:06Z'),
    ]);

    const result = await provider.listRefusalTailedSessionNames(
      new Map([['session-refusal', transcriptPath]]),
    );

    expect(result).toEqual(new Set(['session-refusal']));
  });

  it('reports a session whose transcript ends with repeated refusal entries', async () => {
    const transcriptPath = writeTranscript('refusal-loop.jsonl', [
      normalAssistantEntry('2026-07-12T00:00:00Z'),
      userEntry('2026-07-12T00:10:00Z'),
      refusalSystemEntry('2026-07-12T00:10:05Z'),
      refusalAssistantEntry('2026-07-12T00:10:06Z'),
      userEntry('2026-07-12T00:20:00Z'),
      refusalSystemEntry('2026-07-12T00:20:05Z'),
      refusalAssistantEntry('2026-07-12T00:20:06Z'),
      userEntry('2026-07-12T00:30:00Z'),
      refusalSystemEntry('2026-07-12T00:30:05Z'),
      refusalAssistantEntry('2026-07-12T00:30:06Z'),
    ]);

    const result = await provider.listRefusalTailedSessionNames(
      new Map([['session-refusal-loop', transcriptPath]]),
    );

    expect(result).toEqual(new Set(['session-refusal-loop']));
  });

  it('detects a refusal recorded on the top-level stop_reason field', async () => {
    const transcriptPath = writeTranscript('refusal-top-level.jsonl', [
      normalAssistantEntry('2026-07-12T00:00:00Z'),
      {
        type: 'assistant',
        timestamp: '2026-07-12T00:10:06Z',
        stop_reason: 'refusal',
        message: { role: 'assistant', content: [] },
      },
    ]);

    const result = await provider.listRefusalTailedSessionNames(
      new Map([['session-top-level', transcriptPath]]),
    );

    expect(result).toEqual(new Set(['session-top-level']));
  });

  it('does not report a session when a normal assistant turn follows the refusal', async () => {
    const transcriptPath = writeTranscript('refusal-recovered.jsonl', [
      refusalSystemEntry('2026-07-12T00:10:05Z'),
      refusalAssistantEntry('2026-07-12T00:10:06Z'),
      userEntry('2026-07-12T00:20:00Z'),
      normalAssistantEntry('2026-07-12T00:20:30Z'),
    ]);

    const result = await provider.listRefusalTailedSessionNames(
      new Map([['session-recovered', transcriptPath]]),
    );

    expect(result).toEqual(new Set());
  });

  it('does not report a session when trailing non-assistant entries follow the last normal assistant turn', async () => {
    const transcriptPath = writeTranscript('trailing-user.jsonl', [
      refusalAssistantEntry('2026-07-12T00:10:06Z'),
      normalAssistantEntry('2026-07-12T00:20:30Z'),
      userEntry('2026-07-12T00:30:00Z'),
    ]);

    const result = await provider.listRefusalTailedSessionNames(
      new Map([['session-trailing-user', transcriptPath]]),
    );

    expect(result).toEqual(new Set());
  });

  it('does not report a session whose transcript has no refusal entries', async () => {
    const transcriptPath = writeTranscript('no-refusal.jsonl', [
      normalAssistantEntry('2026-07-12T00:00:00Z'),
      userEntry('2026-07-12T00:10:00Z'),
      normalAssistantEntry('2026-07-12T00:20:30Z'),
    ]);

    const result = await provider.listRefusalTailedSessionNames(
      new Map([['session-normal', transcriptPath]]),
    );

    expect(result).toEqual(new Set());
  });

  it('does not report a session whose transcript file is missing', async () => {
    const result = await provider.listRefusalTailedSessionNames(
      new Map([
        ['session-missing', path.join(rootDirectory, 'does-not-exist.jsonl')],
      ]),
    );

    expect(result).toEqual(new Set());
  });

  it('skips malformed lines and still detects the refusal tail', async () => {
    const filePath = path.join(rootDirectory, 'malformed.jsonl');
    fs.writeFileSync(
      filePath,
      [
        JSON.stringify(normalAssistantEntry('2026-07-12T00:00:00Z')),
        'not-json',
        '',
        JSON.stringify(refusalAssistantEntry('2026-07-12T00:10:06Z')),
      ].join('\n'),
      'utf8',
    );

    const result = await provider.listRefusalTailedSessionNames(
      new Map([['session-malformed', filePath]]),
    );

    expect(result).toEqual(new Set(['session-malformed']));
  });

  it('evaluates each session independently', async () => {
    const refusalPath = writeTranscript('multi-refusal.jsonl', [
      refusalAssistantEntry('2026-07-12T00:10:06Z'),
    ]);
    const normalPath = writeTranscript('multi-normal.jsonl', [
      normalAssistantEntry('2026-07-12T00:10:06Z'),
    ]);

    const result = await provider.listRefusalTailedSessionNames(
      new Map([
        ['session-a', refusalPath],
        ['session-b', normalPath],
      ]),
    );

    expect(result).toEqual(new Set(['session-a']));
  });
});
