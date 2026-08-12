import * as fs from 'fs';
import * as path from 'path';
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

// A transcript user entry is only a genuine owner reply when it was actually
// typed (or queued) by the human owner. Claude Code records the provenance of
// each user entry on the top-level `origin` and `promptSource` fields. A
// genuine human prompt is identified by EITHER `origin.kind === 'human'` OR a
// `promptSource` of `typed`/`queued`; the second condition is required because
// older-format transcripts record genuine human replies with a `promptSource`
// of `queued`/`typed` but no `origin` field, and dropping those would leave a
// real owner reply uncounted and the session waiting forever. Every
// system-injected user entry, by contrast, uses a `promptSource` of `system`
// (sub-agent `task-notification` notices, cross-session `peer` messages) or
// `sdk` (spawn prompts), or has neither field (tool results, skill/meta
// entries) — none of which match. Only a genuine human entry may clear an
// outstanding call-to-user; otherwise a system-injected entry would be
// miscounted as the owner answering and a genuinely waiting session would stop
// being suppressed.
const isGenuineHumanEntry = (parsed: Record<string, unknown>): boolean => {
  const origin = parsed.origin;
  if (isRecord(origin) && readString(origin, 'kind') === 'human') {
    return true;
  }
  const promptSource = readString(parsed, 'promptSource');
  return promptSource === 'typed' || promptSource === 'queued';
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

const OWNER_CALL_TAG_TERMINATOR = '>';
const OWNER_CALL_CANDIDATE_TAG_INFIX = '-pending';
const OWNER_CALL_CANDIDATE_TAG_SUFFIX = `${OWNER_CALL_CANDIDATE_TAG_INFIX}${OWNER_CALL_TAG_TERMINATOR}`;

export const ownerCallMarkerFamilyResolve = (marker: string): string[] =>
  marker.endsWith(OWNER_CALL_TAG_TERMINATOR)
    ? [
        marker,
        `${marker.slice(0, -OWNER_CALL_TAG_TERMINATOR.length)}${OWNER_CALL_CANDIDATE_TAG_SUFFIX}`,
      ]
    : [marker];

// A reply the owner types while the agent is still working is NOT written as a `user` entry: the
// running turn consumes it from the queue, and the transcript keeps only
// {"type":"queue-operation","operation":"enqueue","content":"<the text>"} plus its `remove` twin.
// Reading `user` entries alone therefore misses every mid-turn reply, leaves the call outstanding
// for the rest of the session, and suppresses the stall reminder of a session the owner has
// already answered. The exclusions match the ones the status line applies to the same entries, so
// a system-injected enqueue never counts as an owner reply.
const INJECTED_ENQUEUE_CONTENT_MARKERS = [
  SILENT_SESSION_REMINDER_SENTINEL,
  '<system-reminder>',
  'UserPromptSubmit hook',
  '<task-notification>',
  'SYSTEM NOTIFICATION',
  '<local-command-stdout>',
  '<local-command-caveat>',
  '<command-name>',
  'This session is being continued from a previous conversation',
];

const isOwnerEnqueuedReply = (parsed: Record<string, unknown>): boolean => {
  if (readString(parsed, 'operation') !== 'enqueue') {
    return false;
  }
  const content = readString(parsed, 'content');
  if (content === null || content.length === 0) {
    return false;
  }
  return !INJECTED_ENQUEUE_CONTENT_MARKERS.some((injectedMarker) =>
    content.includes(injectedMarker),
  );
};

const TRANSCRIPT_FILE_EXTENSION = '.jsonl';
const OWNER_REPLY_MARKER_FILE_EXTENSION = '.reply_ts';
const SUPPRESSED_OWNER_CALL_MARKER_FILE_EXTENSION = '.suppress_ts';
const APPROVED_OWNER_CALL_MARKER_FILE_EXTENSION = '.call_ts';
const UNSAFE_SESSION_ID_CHARACTER_PATTERN = /[^A-Za-z0-9._-]/g;

export class TranscriptOwnerCallStatusProvider implements OwnerCallStatusProvider {
  private readonly ownerCallMarkerFamily: string[];

  constructor(
    ownerCallMarker: string | null,
    private readonly ownerReplyMarkerDirectory: string | null = null,
  ) {
    this.ownerCallMarkerFamily =
      ownerCallMarker === null || ownerCallMarker.length === 0
        ? []
        : ownerCallMarkerFamilyResolve(ownerCallMarker);
  }

  listUnansweredOwnerCallEpochSecondsBySessionName = async (
    transcriptPathBySessionName: Map<string, string>,
  ): Promise<Map<string, number>> => {
    const unansweredOwnerCallEpochSecondsBySessionName = new Map<
      string,
      number
    >();
    if (this.ownerCallMarkerFamily.length === 0) {
      return unansweredOwnerCallEpochSecondsBySessionName;
    }
    for (const [sessionName, transcriptPath] of transcriptPathBySessionName) {
      const unansweredOwnerCallEpochMs = this.findUnansweredOwnerCallEpochMs(
        transcriptPath,
        this.ownerCallMarkerFamily,
      );
      if (unansweredOwnerCallEpochMs !== null) {
        unansweredOwnerCallEpochSecondsBySessionName.set(
          sessionName,
          Math.floor(unansweredOwnerCallEpochMs / 1000),
        );
      }
    }
    return unansweredOwnerCallEpochSecondsBySessionName;
  };

  private findUnansweredOwnerCallEpochMs = (
    transcriptPath: string,
    markerFamily: string[],
  ): number | null => {
    let content: string;
    try {
      content = fs.readFileSync(transcriptPath, 'utf8');
    } catch {
      return null;
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
      if (type === 'assistant') {
        const assistantText = extractText(messageContent);
        if (markerFamily.some((marker) => assistantText.includes(marker))) {
          lastOwnerCallEpochMs = epochMs;
        }
      }
      if (
        type === 'user' &&
        isGenuineHumanEntry(parsed) &&
        hasOwnerTextReply(messageContent)
      ) {
        lastOwnerReplyEpochMs = epochMs;
      }
      if (type === 'queue-operation' && isOwnerEnqueuedReply(parsed)) {
        lastOwnerReplyEpochMs =
          lastOwnerReplyEpochMs === null || epochMs > lastOwnerReplyEpochMs
            ? epochMs
            : lastOwnerReplyEpochMs;
      }
    }
    if (lastOwnerCallEpochMs === null) {
      return null;
    }
    if (this.isCallSuppressedUndelivered(transcriptPath, lastOwnerCallEpochMs)) {
      return null;
    }
    const markerReplyEpochMs = this.readOwnerReplyMarkerEpochMs(transcriptPath);
    const resolvedReplyEpochMs =
      markerReplyEpochMs !== null &&
      (lastOwnerReplyEpochMs === null ||
        markerReplyEpochMs > lastOwnerReplyEpochMs)
        ? markerReplyEpochMs
        : lastOwnerReplyEpochMs;
    return resolvedReplyEpochMs === null ||
      lastOwnerCallEpochMs > resolvedReplyEpochMs
      ? lastOwnerCallEpochMs
      : null;
  };

  // The owner sees only the status line, so the reply time it renders is the value the owner
  // believes the fleet is acting on. The status line writes that value to a per-session marker
  // file, and reading it here keeps this decision and the owner's own view of it from diverging.
  // The transcript-derived value still stands on its own: an absent, unreadable, or older marker
  // changes nothing, so a fresh host with no markers yet behaves exactly as before.
  private readOwnerReplyMarkerEpochMs = (
    transcriptPath: string,
  ): number | null =>
    this.readMarkerEpochMs(transcriptPath, OWNER_REPLY_MARKER_FILE_EXTENSION);

  // The format gate the owner's sessions run under can hold an owner call instead of delivering
  // it, and it records that decision beside the reply marker: the held call's timestamp in the
  // suppression marker, and the timestamp of any call it later approved in the approval marker. A
  // held call the approval marker does not name never reached the owner, so treating it as a wait
  // on the owner would silence the session's stall reminder for good — the session would keep its
  // task and never be woken again. Such a call is therefore not an outstanding owner call here. A
  // delivered call, and a newer call the suppression marker does not name, are untouched.
  private isCallSuppressedUndelivered = (
    transcriptPath: string,
    ownerCallEpochMs: number,
  ): boolean => {
    const suppressedEpochMs = this.readMarkerEpochMs(
      transcriptPath,
      SUPPRESSED_OWNER_CALL_MARKER_FILE_EXTENSION,
    );
    if (suppressedEpochMs === null || suppressedEpochMs !== ownerCallEpochMs) {
      return false;
    }
    const approvedEpochMs = this.readMarkerEpochMs(
      transcriptPath,
      APPROVED_OWNER_CALL_MARKER_FILE_EXTENSION,
    );
    return approvedEpochMs !== suppressedEpochMs;
  };

  private readMarkerEpochMs = (
    transcriptPath: string,
    markerFileExtension: string,
  ): number | null => {
    if (this.ownerReplyMarkerDirectory === null) {
      return null;
    }
    const fileName = path.basename(transcriptPath);
    const sessionId = fileName.endsWith(TRANSCRIPT_FILE_EXTENSION)
      ? fileName.slice(0, -TRANSCRIPT_FILE_EXTENSION.length)
      : fileName;
    const safeSessionId = sessionId.replace(
      UNSAFE_SESSION_ID_CHARACTER_PATTERN,
      '_',
    );
    let markerContent: string;
    try {
      markerContent = fs.readFileSync(
        path.join(
          this.ownerReplyMarkerDirectory,
          `${safeSessionId}${markerFileExtension}`,
        ),
        'utf8',
      );
    } catch {
      return null;
    }
    return parseEpochMilliseconds(markerContent.split('\n')[0].trim());
  };
}
