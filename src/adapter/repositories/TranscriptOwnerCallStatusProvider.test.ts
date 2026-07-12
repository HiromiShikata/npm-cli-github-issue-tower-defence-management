import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TranscriptOwnerCallStatusProvider } from './TranscriptOwnerCallStatusProvider';
import { SILENT_SESSION_REMINDER_SENTINEL } from '../../domain/usecases/silentSessionReminderSentinel';

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

  const writeTranscript = (fileName: string, lines: object[]): string => {
    const filePath = path.join(rootDirectory, fileName);
    fs.writeFileSync(
      filePath,
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'utf8',
    );
    return filePath;
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
    origin: { kind: 'human' },
    promptSource: 'typed',
    message: { role: 'user', content: 'go ahead' },
  });

  const ownerReplyQueuedNoOrigin = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    promptSource: 'queued',
    message: { role: 'user', content: 'go ahead' },
  });

  const taskNotification = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    origin: { kind: 'task-notification' },
    promptSource: 'system',
    message: {
      role: 'user',
      content:
        '<task-notification>\n<task-id>abc123</task-id>\nA sub-agent finished.\n</task-notification>',
    },
  });

  const peerAgentMessage = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    origin: { kind: 'peer' },
    promptSource: 'system',
    isMeta: true,
    message: {
      role: 'user',
      content: 'Another Claude session sent a message: please continue.',
    },
  });

  const toolResult = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    message: {
      role: 'user',
      content: [{ type: 'tool_result', content: 'ok' }],
    },
  });

  const injectedReminderStringContent = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    message: {
      role: 'user',
      content: `${SILENT_SESSION_REMINDER_SENTINEL} You have produced no output for 10 minutes. Self-check now:`,
    },
  });

  const injectedReminderBlockContent = (timestamp: string): object => ({
    type: 'user',
    timestamp,
    message: {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `${SILENT_SESSION_REMINDER_SENTINEL} The following sub-processes have been silent or running for a long time:`,
        },
      ],
    },
  });

  const sessionName = 'workbench';

  it('reports a session as waiting when the last owner call is newer than the last owner reply', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      ownerReply('2026-06-27T10:00:00.000Z'),
      assistantWithMarker('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('exposes the epoch seconds of the unanswered owner call so its age can be computed', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      ownerReply('2026-06-27T10:00:00.000Z'),
      assistantWithMarker('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.get(sessionName)).toBe(
      Math.floor(Date.parse('2026-06-27T10:05:00.000Z') / 1000),
    );
  });

  it('exposes the epoch seconds of the latest owner call when several calls are unanswered', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T09:00:00.000Z'),
      assistantWithMarker('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.get(sessionName)).toBe(
      Math.floor(Date.parse('2026-06-27T10:05:00.000Z') / 1000),
    );
  });

  it('does not report a session as waiting when a later owner reply followed the call', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      ownerReply('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('compares full datetimes rather than only the time of day', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T23:00:00.000Z'),
      ownerReply('2026-06-28T01:00:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('treats tool results as not being owner replies', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      toolResult('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('does not count a monitor-injected reminder with string content as an owner reply', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      injectedReminderStringContent('2026-06-27T10:10:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('does not count a monitor-injected reminder with text-block content as an owner reply', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      injectedReminderBlockContent('2026-06-27T10:10:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('still counts a genuine owner reply that arrives after a monitor-injected reminder', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      injectedReminderStringContent('2026-06-27T10:10:00.000Z'),
      ownerReply('2026-06-27T10:20:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('does not count a system-injected task-notification user entry as an owner reply', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      taskNotification('2026-06-27T10:10:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('does not count a cross-session peer agent message as an owner reply', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      peerAgentMessage('2026-06-27T10:10:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('counts a genuine human reply that has promptSource queued but no origin field', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      ownerReplyQueuedNoOrigin('2026-06-27T10:10:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('counts a genuine human-origin reply that arrives after a task-notification', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantWithMarker('2026-06-27T10:00:00.000Z'),
      taskNotification('2026-06-27T10:10:00.000Z'),
      ownerReply('2026-06-27T10:20:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('does not report a session that never raised an owner call', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      assistantPlain('2026-06-27T10:00:00.000Z'),
      ownerReply('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(false);
  });

  it('returns an empty map when the marker is null', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      ownerReply('2026-06-27T10:00:00.000Z'),
      assistantWithMarker('2026-06-27T10:05:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider(null);

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.size).toBe(0);
  });

  it('ignores a session whose transcript file is missing', async () => {
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, path.join(rootDirectory, 'missing.jsonl')]]),
      );

    expect(result.size).toBe(0);
  });

  it('ignores malformed transcript lines', async () => {
    const filePath = path.join(rootDirectory, 'workbench.jsonl');
    fs.writeFileSync(
      filePath,
      [
        'not json',
        JSON.stringify(assistantWithMarker('2026-06-27T10:05:00.000Z')),
      ].join('\n'),
      'utf8',
    );
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, filePath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });

  it('uses the canonical call-to-user marker string', async () => {
    const transcriptPath = writeTranscript('workbench.jsonl', [
      {
        type: 'assistant',
        timestamp: '2026-06-27T10:05:00.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Please decide <call-to-user>' }],
        },
      },
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<call-to-user>');

    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([[sessionName, transcriptPath]]),
      );

    expect(result.has(sessionName)).toBe(true);
  });
});
