export const OWNER_CONFIRMATION_REPLY = 'はい';

// Speech is compared after removing whitespace and these punctuation marks,
// so that a split or punctuated transcript of はい still counts.
const SPEECH_IGNORED_PATTERN = /[\s。、.,!?！？]/g;

export const normalizeSpeech = (speech: string): string =>
  speech.replace(SPEECH_IGNORED_PATTERN, '');

export type PreparedVoiceAction = {
  actionId: string;
  requestPath: string;
  body: Record<string, unknown>;
  readBack: string;
  removesFromQueue: boolean;
};

export type VoiceConsolePendingConfirmResult =
  | { ok: true; action: PreparedVoiceAction }
  | {
      ok: false;
      error: 'no_pending_action' | 'action_id_mismatch' | 'owner_reply_not_yes';
    };

export class VoiceConsolePendingActionStore {
  private pending: PreparedVoiceAction | null = null;

  prepare(action: PreparedVoiceAction): void {
    this.pending = action;
  }

  current(): PreparedVoiceAction | null {
    return this.pending;
  }

  confirm(
    actionId: string,
    ownerReply: string,
  ): VoiceConsolePendingConfirmResult {
    const action = this.pending;
    if (action === null) {
      return { ok: false, error: 'no_pending_action' };
    }
    if (action.actionId !== actionId) {
      return { ok: false, error: 'action_id_mismatch' };
    }
    if (ownerReply.trim() !== OWNER_CONFIRMATION_REPLY) {
      return { ok: false, error: 'owner_reply_not_yes' };
    }
    this.pending = null;
    return { ok: true, action };
  }

  cancel(): void {
    this.pending = null;
  }
}
