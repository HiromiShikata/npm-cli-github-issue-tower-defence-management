export interface SilentSessionNotificationRepository {
  sendSelfCheckNotification: (
    sessionName: string,
    message: string,
  ) => Promise<void>;
}
