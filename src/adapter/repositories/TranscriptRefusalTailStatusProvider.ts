import * as fs from 'fs';
import { RefusalTailStatusProvider } from '../../domain/usecases/adapter-interfaces/RefusalTailStatusProvider';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (
  value: Record<string, unknown>,
  key: string,
): string | null => {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : null;
};

// A model refusal is durably recorded in the session transcript JSONL as an
// assistant entry whose stop reason is `refusal` (a system entry with
// `subtype: 'model_refusal_no_fallback'` precedes it). The stop reason lives
// on the embedded API message (`message.stop_reason`); the top-level field is
// also checked for robustness against transcript format variations.
const isRefusalAssistantEntry = (parsed: Record<string, unknown>): boolean => {
  if (readString(parsed, 'type') !== 'assistant') {
    return false;
  }
  if (readString(parsed, 'stop_reason') === 'refusal') {
    return true;
  }
  const message = parsed.message;
  return isRecord(message) && readString(message, 'stop_reason') === 'refusal';
};

export class TranscriptRefusalTailStatusProvider implements RefusalTailStatusProvider {
  // A session is refusal-tailed when the most recent assistant entry in its
  // transcript is a model refusal. Sending a reminder to such a session is
  // guaranteed to burn a full-context API call and produce another refusal,
  // so the monitor excludes it from reminder candidates. The gate is purely
  // state-based: as soon as any non-refusal assistant entry appears after the
  // refusal (manual nudge, restart, compaction), the session is no longer
  // refusal-tailed and reminders resume.
  listRefusalTailedSessionNames = async (
    transcriptPathBySessionName: Map<string, string>,
  ): Promise<Set<string>> => {
    const refusalTailedSessionNames = new Set<string>();
    for (const [sessionName, transcriptPath] of transcriptPathBySessionName) {
      if (this.isTranscriptRefusalTailed(transcriptPath)) {
        refusalTailedSessionNames.add(sessionName);
      }
    }
    return refusalTailedSessionNames;
  };

  private isTranscriptRefusalTailed = (transcriptPath: string): boolean => {
    let content: string;
    try {
      content = fs.readFileSync(transcriptPath, 'utf8');
    } catch {
      return false;
    }
    let lastAssistantEntryIsRefusal = false;
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
      if (readString(parsed, 'type') !== 'assistant') {
        continue;
      }
      lastAssistantEntryIsRefusal = isRefusalAssistantEntry(parsed);
    }
    return lastAssistantEntryIsRefusal;
  };
}
