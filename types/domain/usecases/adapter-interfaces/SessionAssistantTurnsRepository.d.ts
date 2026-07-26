export interface SessionAssistantTurnsRepository {
    listRecentAssistantTurnsBySessionName: (transcriptPathBySessionName: Map<string, string>, maxTurnsPerSession: number) => Promise<Map<string, string[]>>;
}
//# sourceMappingURL=SessionAssistantTurnsRepository.d.ts.map