export interface SilentSessionNotificationRepository {
    getLastNotifiedEpochSeconds: (sessionName: string) => Promise<number | null>;
    setLastNotifiedEpochSeconds: (sessionName: string, epochSeconds: number) => Promise<void>;
    sendSelfCheckNotification: (sessionName: string, message: string) => Promise<void>;
}
//# sourceMappingURL=SilentSessionNotificationRepository.d.ts.map