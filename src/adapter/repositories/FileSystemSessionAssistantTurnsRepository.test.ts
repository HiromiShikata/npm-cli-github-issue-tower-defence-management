import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemSessionAssistantTurnsRepository } from './FileSystemSessionAssistantTurnsRepository';

describe('FileSystemSessionAssistantTurnsRepository', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'assistant-turns-'),
    );
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  const writeTranscript = (fileName: string, lines: string[]): string => {
    const filePath = path.join(temporaryDirectory, fileName);
    fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
    return filePath;
  };

  it('returns recent assistant turn texts newest first, ignoring non-assistant lines', async () => {
    const filePath = writeTranscript('transcript.jsonl', [
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'first turn' }] },
      }),
      JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'text', text: 'a user turn' }] },
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'second turn' },
            { type: 'tool_use', id: 'tool-1', name: 'Bash' },
          ],
        },
      }),
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'third turn' }] },
      }),
    ]);

    const repository = new FileSystemSessionAssistantTurnsRepository();
    const result = await repository.listRecentAssistantTurnsBySessionName(
      new Map([['session', filePath]]),
      10,
    );

    expect(result.get('session')).toEqual([
      'third turn',
      'second turn',
      'first turn',
    ]);
  });

  it('limits the number of turns returned to maxTurnsPerSession', async () => {
    const filePath = writeTranscript('transcript.jsonl', [
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'oldest' }] },
      }),
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'middle' }] },
      }),
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'newest' }] },
      }),
    ]);

    const repository = new FileSystemSessionAssistantTurnsRepository();
    const result = await repository.listRecentAssistantTurnsBySessionName(
      new Map([['session', filePath]]),
      2,
    );

    expect(result.get('session')).toEqual(['newest', 'middle']);
  });

  it('reads a string content assistant message', async () => {
    const filePath = writeTranscript('transcript.jsonl', [
      JSON.stringify({
        type: 'assistant',
        message: { content: 'plain string turn' },
      }),
    ]);

    const repository = new FileSystemSessionAssistantTurnsRepository();
    const result = await repository.listRecentAssistantTurnsBySessionName(
      new Map([['session', filePath]]),
      10,
    );

    expect(result.get('session')).toEqual(['plain string turn']);
  });

  it('omits a session whose transcript is missing', async () => {
    const repository = new FileSystemSessionAssistantTurnsRepository();
    const result = await repository.listRecentAssistantTurnsBySessionName(
      new Map([['session', path.join(temporaryDirectory, 'absent.jsonl')]]),
      10,
    );

    expect(result.has('session')).toBe(false);
  });

  it('drops the first partial line when reading only the transcript tail', async () => {
    const firstLine = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'partial old turn' }] },
    });
    const secondLine = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'complete new turn' }] },
    });
    const filePath = writeTranscript('transcript.jsonl', [
      firstLine,
      secondLine,
    ]);

    const tailBytes = Buffer.byteLength(`${secondLine}\n`) + 5;
    const repository = new FileSystemSessionAssistantTurnsRepository(tailBytes);
    const result = await repository.listRecentAssistantTurnsBySessionName(
      new Map([['session', filePath]]),
      10,
    );

    expect(result.get('session')).toEqual(['complete new turn']);
  });
});
