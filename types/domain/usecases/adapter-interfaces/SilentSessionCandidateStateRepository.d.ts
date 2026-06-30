export interface SilentSessionCandidateStateRepository {
    loadRecentCandidateSessionNames: (params: {
        now: Date;
        recencyWindowSeconds: number;
    }) => Promise<Set<string>>;
    saveCandidateSessionNames: (params: {
        sessionNames: string[];
        now: Date;
    }) => Promise<void>;
}
//# sourceMappingURL=SilentSessionCandidateStateRepository.d.ts.map