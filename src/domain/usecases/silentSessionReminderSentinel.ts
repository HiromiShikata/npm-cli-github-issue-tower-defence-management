// Stable, recognizable marker embedded in every monitor-injected silent-session
// self-check reminder. It lets owner-reply detection distinguish a reminder that
// the monitor injected into a session's transcript (which arrives as a user text
// entry via `tmux send-keys`) from a genuine owner reply, so an injected reminder
// is never miscounted as the owner answering an outstanding call-to-user. The tag
// is bracketed and namespaced to make an accidental collision with genuine human
// owner text effectively impossible.
export const SILENT_SESSION_REMINDER_SENTINEL =
  '[TDPM_SILENT_SESSION_SELF_CHECK_REMINDER]';
