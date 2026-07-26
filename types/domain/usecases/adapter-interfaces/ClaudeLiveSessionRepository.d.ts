export type ClaudeLiveSession = {
    token: string;
    sessionKey: string;
};
export interface ClaudeLiveSessionRepository {
    listLiveSessions: () => ClaudeLiveSession[];
}
//# sourceMappingURL=ClaudeLiveSessionRepository.d.ts.map