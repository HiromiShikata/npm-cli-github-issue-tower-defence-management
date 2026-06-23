export type ClaudeLiveSession = {
    token: string;
    sessionId: string;
};
export interface ClaudeLiveSessionRepository {
    listLiveSessions: () => ClaudeLiveSession[];
}
//# sourceMappingURL=ClaudeLiveSessionRepository.d.ts.map