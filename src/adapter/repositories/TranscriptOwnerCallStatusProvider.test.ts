import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TranscriptOwnerCallStatusProvider } from './TranscriptOwnerCallStatusProvider';

describe('TranscriptOwnerCallStatusProvider', () => {
  let rootDirectory: string;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'owner-call-status-'),
    );
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { force: true, recursive: true });
  });

  const writeTranscript = (sessionName: string, lines: object[]): void => {
    const fileName = `${sessionName.replace(/\//g, '_')}.jsonl`;
    const filePath = path.join(rootDirectory, fileName);
    fs.writeFileSync(
      filePath,
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'utf8',
    );
  };

  const assistantWithMarker = (timestamp: string): object => ({
    type: 'assistant',
    timestamp,
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: 'Waiting <<OWNER_CALL>> please decide.' },
      ],
    },
  });

  const assistantPlain = (timestamp: string): object => ({
    type: 'assistant',
    timestamp,
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'progress update' }],
    },
  });

  const ownerReply = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    message: { role: 'user', content: 'go ahead' },
  });

  const toolResult = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    message: {
      role: 'user',
      content: [{ type: 'tool_result', content: 'ok' }],
    },
  });

  it('reports a session as waiting when the last owner call is newer than the last owner reply', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeTranscript(sessionName, [
      ownerReply('2026-06-27T10:00:00.000Z'),
      assistantWithMarker('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider(
      rootDirectory,
      '<<OWNER_CALL>>',
    );

    const result = await provider.listSessionNamesWithUnansweredOwnerCall([
      sessionName,
    ]);

    expect(result.has(sessionName)).toBe(true);
  });

  it('does not report a session as waiting when a later owner reply followed the call', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeTranscript(sessionName, [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      ownerReply('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider(
      rootDirectory,
      '<<OWNER_CALL>>',
    );

    const result = await provider.listSessionNamesWithUnansweredOwnerCall([
      sessionName,
    ]);

    expect(result.has(sessionName)).toBe(false);
  });

  it('compares full datetimes rather than only the time of day', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeTranscript(sessionName, [
      assistantWithMarker('2026-06-27T23:00:00.000Z'),
      ownerReply('2026-06-28T01:00:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider(
      rootDirectory,
      '<<OWNER_CALL>>',
    );

    const result = await provider.listSessionNamesWithUnansweredOwnerCall([
      sessionName,
    ]);

    expect(result.has(sessionName)).toBe(false);
  });

  it('treats tool results as not being owner replies', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeTranscript(sessionName, [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      toolResult('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider(
      rootDirectory,
      '<<OWNER_CALL>>',
    );

    const result = await provider.listSessionNamesWithUnansweredOwnerCall([
      sessionName,
    ]);

    expect(result.has(sessionName)).toBe(true);
  });

  it('does not report a session that never raised an owner call', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeTranscript(sessionName, [
      assistantPlain('2026-06-27T10:00:00.000Z'),
      ownerReply('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider(
      rootDirectory,
      '<<OWNER_CALL>>',
    );

    const result = await provider.listSessionNamesWithUnansweredOwnerCall([
      sessionName,
    ]);

    expect(result.has(sessionName)).toBe(false);
  });

  it('returns an empty set when the root directory is null', async () => {
    const provider = new TranscriptOwnerCallStatusProvider(
      null,
      '<<OWNER_CALL>>',
    );

    const result = await provider.listSessionNamesWithUnansweredOwnerCall([
      'https_//github_com/owner/repo/issues/9',
    ]);

    expect(result.size).toBe(0);
  });

  it('returns an empty set when the marker is null', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    writeTranscript(sessionName, [
      ownerReply('2026-06-27T10:00:00.000Z'),
      assistantWithMarker('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider(rootDirectory, null);

    const result = await provider.listSessionNamesWithUnansweredOwnerCall([
      sessionName,
    ]);

    expect(result.size).toBe(0);
  });

  it('ignores a session whose transcript file is missing', async () => {
    const provider = new TranscriptOwnerCallStatusProvider(
      rootDirectory,
      '<<OWNER_CALL>>',
    );

    const result = await provider.listSessionNamesWithUnansweredOwnerCall([
      'https_//github_com/owner/repo/issues/9',
    ]);

    expect(result.size).toBe(0);
  });

  it('ignores malformed transcript lines', async () => {
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    const fileName = `${sessionName.replace(/\//g, '_')}.jsonl`;
    const filePath = path.join(rootDirectory, fileName);
    fs.writeFileSync(
      filePath,
      [
        'not json',
        JSON.stringify(assistantWithMarker('2026-06-27T10:05:00.000Z')),
      ].join('\n'),
      'utf8',
    );
    const provider = new TranscriptOwnerCallStatusProvider(
      rootDirectory,
      '<<OWNER_CALL>>',
    );

    const result = await provider.listSessionNamesWithUnansweredOwnerCall([
      sessionName,
    ]);

    expect(result.has(sessionName)).toBe(true);
  });
});
