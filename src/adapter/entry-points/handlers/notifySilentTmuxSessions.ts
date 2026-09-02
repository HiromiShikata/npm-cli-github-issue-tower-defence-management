export type NotifySilentTmuxSessionsParams = {
  enabled: boolean;
};

export const notifySilentTmuxSessions = async (
  params: NotifySilentTmuxSessionsParams,
): Promise<void> => {
  if (!params.enabled) {
    console.log(
      'Silent live session notification skipped: not enabled (set silentNotificationEnabled or TDPM_SILENT_NOTIFICATION_ENABLED=true to enable).',
    );
    return;
  }
  console.log(
    'Silent live session notification: all reminder sections removed; no notifications to send.',
  );
};

export const DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS = {} as const;
