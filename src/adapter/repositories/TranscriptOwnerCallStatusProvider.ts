import * as fs from 'fs';
import * as path from 'path';
import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (
  value: Record<string, unknown>,
  key: string,
): string | null => {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : null;
};

const parseEpochMilliseconds = (timestamp: string | null): number | null => {
  if (timestamp === null) {
    return null;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : parsed;
};

const extractText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  const texts: string[] = [];
  for (const block of content) {
    if (isRecord(block) && block.type === 'text') {
      const text = readString(block, 'text');
      if (text !== null) {
        texts.push(text);
      }
    }
  }
  return texts.join('\n');
};

const hasOwnerTextReply = (content: unknown): boolean => {
  if (typeof content === 'string') {
    return content.length > 0;
  }
  if (!Array.isArray(content)) {
    return false;
  }
  return content.some((block) => isRecord(block) && block.type === 'text');
};

export class TranscriptOwnerCallStatusProvider implements OwnerCallStatusProvider {
  constructor(
    private readonly rootDirectory: string | null,
    private readonly ownerCallMarker: string | null,
  ) {}

  listSessionNamesWithUnansweredOwnerCall = async (
    sessionNames: string[],
  ): Promise<Set<string>> => {
    const waiting = new Set<string>();
    if (
      this.rootDirectory === null ||
      this.ownerCallMarker === null ||
      this.ownerCallMarker.length === 0
    ) {
      return waiting;
    }
    for (const sessionName of sessionNames) {
      if (this.isWaitingForOwnerReply(sessionName, this.ownerCallMarker)) {
        waiting.add(sessionName);
      }
    }
    return waiting;
  };

  private isWaitingForOwnerReply = (
    sessionName: string,
    marker: string,
  ): boolean => {
    if (this.rootDirectory === null) {
      return false;
    }
    const filePath = path.join(
      this.rootDirectory,
      this.toTranscriptFileName(sessionName),
    );
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return false;
    }
    let lastOwnerCallEpochMs: number | null = null;
    let lastOwnerReplyEpochMs: number | null = null;
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (!isRecord(parsed)) {
        continue;
      }
      const epochMs = parseEpochMilliseconds(readString(parsed, 'timestamp'));
      if (epochMs === null) {
        continue;
      }
      const type = readString(parsed, 'type');
      const message = parsed.message;
      const messageContent = isRecord(message) ? message.content : null;
      if (
        type === 'assistant' &&
        extractText(messageContent).includes(marker)
      ) {
        lastOwnerCallEpochMs = epochMs;
      }
      if (type === 'user' && hasOwnerTextReply(messageContent)) {
        lastOwnerReplyEpochMs = epochMs;
      }
    }
    if (lastOwnerCallEpochMs === null) {
      return false;
    }
    return (
      lastOwnerReplyEpochMs === null ||
      lastOwnerCallEpochMs > lastOwnerReplyEpochMs
    );
  };

  private toTranscriptFileName = (sessionName: string): string =>
    `${sessionName.replace(/\//g, '_')}.jsonl`;
}
