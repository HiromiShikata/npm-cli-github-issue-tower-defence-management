import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TranscriptOwnerCallStatusProvider } from './TranscriptOwnerCallStatusProvider';

describe('TranscriptOwnerCallStatusProvider single transcript scan', () => {
  let rootDirectory: string;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'single-scan-'));
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

  const epochSecondsOf = (timestamp: string): number =>
    Math.floor(Date.parse(timestamp) / 1000);

  it('serves a repeated reminder path request from one read of the transcript', async () => {
    const transcriptPath = writeTranscript('session.jsonl', [
      assistantWithMarker('2026-08-13T10:00:00.000Z'),
    ]);
    const transcriptPathBySessionName = new Map([['session', transcriptPath]]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const firstEpochSeconds =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        transcriptPathBySessionName,
      );

    writeTranscript('session.jsonl', [
      assistantWithMarker('2026-08-13T11:00:00.000Z'),
    ]);

    const secondEpochSeconds =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        transcriptPathBySessionName,
      );

    expect(firstEpochSeconds.get('session')).toBe(
      epochSecondsOf('2026-08-13T10:00:00.000Z'),
    );
    expect(secondEpochSeconds.get('session')).toBe(
      epochSecondsOf('2026-08-13T10:00:00.000Z'),
    );
  });

  it('scans a transcript that only the reminder path asked for', async () => {
    const transcriptPath = writeTranscript('reminder-only.jsonl', [
      assistantWithMarker('2026-08-13T12:00:00.000Z'),
    ]);
    const provider = new TranscriptOwnerCallStatusProvider('<<OWNER_CALL>>');

    const epochSeconds =
      await provider.listUnansweredOwnerCallEpochSecondsBySessionName(
        new Map([['session', transcriptPath]]),
      );

    expect(epochSeconds.get('session')).toBe(
      epochSecondsOf('2026-08-13T12:00:00.000Z'),
    );
  });
});
