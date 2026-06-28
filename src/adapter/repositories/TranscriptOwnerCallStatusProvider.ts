import * as fs from 'fs';
import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
import { SILENT_SESSION_REMINDER_SENTINEL } from '../../domain/usecases/silentSessionReminderSentinel';

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
    if (content.length === 0) {
      return false;
    }
    // A monitor-injected self-check reminder lands in the target session's
    // transcript as a user text entry. It carries the reminder sentinel, so it
    // is the monitor talking to the session, not the owner replying. It MUST NOT
    // advance the last-owner-reply time, otherwise an outstanding call-to-user
    // is wrongly treated as answered and the session stops being suppressed.
    return !content.includes(SILENT_SESSION_REMINDER_SENTINEL);
  }
  if (!Array.isArray(content)) {
    return false;
  }
  const hasTextBlock = content.some(
    (block) => isRecord(block) && block.type === 'text',
  );
  if (!hasTextBlock) {
    return false;
  }
  return !extractText(content).includes(SILENT_SESSION_REMINDER_SENTINEL);
};

export class TranscriptOwnerCallStatusProvider implements OwnerCallStatusProvider {
  constructor(private readonly ownerCallMarker: string | null) {}

  listSessionNamesWithUnansweredOwnerCall = async (
    transcriptPathBySessionName: Map<string, string>,
  ): Promise<Set<string>> => {
    const waiting = new Set<string>();
    if (this.ownerCallMarker === null || this.ownerCallMarker.length === 0) {
      return waiting;
    }
    const marker = this.ownerCallMarker;
    for (const [sessionName, transcriptPath] of transcriptPathBySessionName) {
      if (this.isWaitingForOwnerReply(transcriptPath, marker)) {
        waiting.add(sessionName);
      }
    }
    return waiting;
  };

  private isWaitingForOwnerReply = (
    transcriptPath: string,
    marker: string,
  ): boolean => {
    let content: string;
    try {
      content = fs.readFileSync(transcriptPath, 'utf8');
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
}
