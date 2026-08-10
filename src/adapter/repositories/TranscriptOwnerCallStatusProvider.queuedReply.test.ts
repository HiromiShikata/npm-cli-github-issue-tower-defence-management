import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TranscriptOwnerCallStatusProvider } from './TranscriptOwnerCallStatusProvider';
import { SILENT_SESSION_REMINDER_SENTINEL } from '../../domain/usecases/silentSessionReminderSentinel';

describe('TranscriptOwnerCallStatusProvider owner reply typed mid-turn', () => {
  let rootDirectory: string;
  let markerDirectory: string;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'queued-reply-'));
    markerDirectory = path.join(rootDirectory, 'markers');
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { force: true, recursive: true });
  });

  const sessionId = 'e7a58bf9-4d13-4e27-b446-52c3b017ad79';
  const callTimestamp = '2026-08-10T11:04:26.331Z';
  const earlierReplyTimestamp = '2026-08-10T11:02:40.286Z';
  const laterReplyTimestamp = '2026-08-10T11:05:53.576Z';

  const writeTranscript = (lines: object[]): string => {
    const filePath = path.join(rootDirectory, `${sessionId}.jsonl`);
    fs.writeFileSync(
      filePath,
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'utf8',
    );
    return filePath;
  };

  const writeReplyMarker = (timestamp: string): void => {
    fs.mkdirSync(markerDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(markerDirectory, `${sessionId}.reply_ts`),
      `${timestamp}\n`,
      'utf8',
    );
  };

  const ownerCall = (timestamp: string): object => ({
    type: 'assistant',
    timestamp,
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'Please decide <<OWNER_CALL>>' }],
    },
  });

  const typedReply = (timestamp: string, text: string): object => ({
    type: 'user',
    timestamp,
    promptSource: 'typed',
    origin: { kind: 'human' },
    message: { role: 'user', content: text },
  });

  const enqueued = (timestamp: string, content: string): object => ({
    type: 'queue-operation',
    operation: 'enqueue',
    timestamp,
    sessionId,
    content,
  });

  const removed = (timestamp: string, content: string): object => ({
    type: 'queue-operation',
    operation: 'remove',
    timestamp,
    sessionId,
    content,
  });

  const unansweredSecondsOf = async (
    transcriptPath: string,
    replyMarkerDirectory: string | null,
  ): Promise<number | undefined> => {
    const provider = new TranscriptOwnerCallStatusProvider(
      '<<OWNER_CALL>>',
      replyMarkerDirectory,
    );
    const result =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([['session', transcriptPath]]),
      );
    return result.get('session');
  };

  it('treats a reply enqueued while the agent was working as an answer to the call', async () => {
    const transcriptPath = writeTranscript([
      typedReply(earlierReplyTimestamp, 'an earlier answer'),
      ownerCall(callTimestamp),
      enqueued(laterReplyTimestamp, 'CI が通っていないのに許可はできません'),
      removed('2026-08-10T11:06:07.885Z', 'CI が通っていないのに許可はできません'),
    ]);

    expect(await unansweredSecondsOf(transcriptPath, null)).toBeUndefined();
  });

  it('keeps the call unanswered when the only later enqueue is a task notification', async () => {
    const transcriptPath = writeTranscript([
      typedReply(earlierReplyTimestamp, 'an earlier answer'),
      ownerCall(callTimestamp),
      enqueued(
        laterReplyTimestamp,
        '<task-notification><task-id>abc</task-id></task-notification>',
      ),
    ]);

    expect(await unansweredSecondsOf(transcriptPath, null)).toBe(
      Math.floor(Date.parse(callTimestamp) / 1000),
    );
  });

  it('keeps the call unanswered when the only later enqueue is an injected reminder', async () => {
    const transcriptPath = writeTranscript([
      typedReply(earlierReplyTimestamp, 'an earlier answer'),
      ownerCall(callTimestamp),
      enqueued(
        laterReplyTimestamp,
        `${SILENT_SESSION_REMINDER_SENTINEL} check yourself`,
      ),
    ]);

    expect(await unansweredSecondsOf(transcriptPath, null)).toBe(
      Math.floor(Date.parse(callTimestamp) / 1000),
    );
  });

  it('treats the reply time recorded by the status line marker as an answer to the call', async () => {
    const transcriptPath = writeTranscript([
      typedReply(earlierReplyTimestamp, 'an earlier answer'),
      ownerCall(callTimestamp),
    ]);
    writeReplyMarker(laterReplyTimestamp);

    expect(
      await unansweredSecondsOf(transcriptPath, markerDirectory),
    ).toBeUndefined();
  });

  it('keeps the call unanswered when the status line marker predates the call', async () => {
    const transcriptPath = writeTranscript([
      typedReply(earlierReplyTimestamp, 'an earlier answer'),
      ownerCall(callTimestamp),
    ]);
    writeReplyMarker(earlierReplyTimestamp);

    expect(await unansweredSecondsOf(transcriptPath, markerDirectory)).toBe(
      Math.floor(Date.parse(callTimestamp) / 1000),
    );
  });

  it('keeps the call unanswered when no marker file exists for the session', async () => {
    const transcriptPath = writeTranscript([
      typedReply(earlierReplyTimestamp, 'an earlier answer'),
      ownerCall(callTimestamp),
    ]);
    fs.mkdirSync(markerDirectory, { recursive: true });

    expect(await unansweredSecondsOf(transcriptPath, markerDirectory)).toBe(
      Math.floor(Date.parse(callTimestamp) / 1000),
    );
  });
});
