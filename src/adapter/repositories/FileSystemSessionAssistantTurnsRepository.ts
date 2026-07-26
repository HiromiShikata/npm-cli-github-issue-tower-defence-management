import * as fs from 'fs';
import { SessionAssistantTurnsRepository } from '../../domain/usecases/adapter-interfaces/SessionAssistantTurnsRepository';

export const DEFAULT_TRANSCRIPT_TAIL_BYTES = 3_000_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const assistantText = (message: Record<string, unknown>): string => {
  const content = message.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (
        isRecord(block) &&
        block.type === 'text' &&
        typeof block.text === 'string'
      ) {
        parts.push(block.text);
      }
    }
    return parts.join(' ');
  }
  return '';
};

export class FileSystemSessionAssistantTurnsRepository implements SessionAssistantTurnsRepository {
  constructor(
    private readonly tailBytes: number = DEFAULT_TRANSCRIPT_TAIL_BYTES,
  ) {}

  listRecentAssistantTurnsBySessionName = async (
    transcriptPathBySessionName: Map<string, string>,
    maxTurnsPerSession: number,
  ): Promise<Map<string, string[]>> => {
    const turnsBySessionName = new Map<string, string[]>();
    for (const [sessionName, transcriptPath] of transcriptPathBySessionName) {
      const turns = this.readRecentAssistantTurns(
        transcriptPath,
        maxTurnsPerSession,
      );
      if (turns.length > 0) {
        turnsBySessionName.set(sessionName, turns);
      }
    }
    return turnsBySessionName;
  };

  private readRecentAssistantTurns = (
    transcriptPath: string,
    maxTurns: number,
  ): string[] => {
    const lines = this.readTailLines(transcriptPath);
    const turns: string[] = [];
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const trimmed = lines[index].trim();
      if (trimmed.length === 0) {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (!isRecord(parsed) || parsed.type !== 'assistant') {
        continue;
      }
      const message = parsed.message;
      if (!isRecord(message)) {
        continue;
      }
      const text = assistantText(message);
      if (text.trim().length === 0) {
        continue;
      }
      turns.push(text);
      if (turns.length >= maxTurns) {
        break;
      }
    }
    return turns;
  };

  private readTailLines = (transcriptPath: string): string[] => {
    let handle: number;
    try {
      handle = fs.openSync(transcriptPath, 'r');
    } catch {
      return [];
    }
    try {
      const size = fs.fstatSync(handle).size;
      const start = size > this.tailBytes ? size - this.tailBytes : 0;
      const length = size - start;
      const buffer = new Uint8Array(length);
      fs.readSync(handle, buffer, 0, length, start);
      let text = Buffer.from(buffer).toString('utf8');
      if (start > 0) {
        const newlineIndex = text.indexOf('\n');
        text = newlineIndex === -1 ? '' : text.slice(newlineIndex + 1);
      }
      return text.split('\n');
    } catch {
      return [];
    } finally {
      fs.closeSync(handle);
    }
  };
}
