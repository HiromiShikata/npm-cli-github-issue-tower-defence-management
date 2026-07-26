export interface SubAgentLivenessResolver {
    resolveLiveSubAgentIds: (params: {
        sessionName: string;
        mainTranscriptPath: string | null;
    }) => Promise<Set<string> | null>;
}
//# sourceMappingURL=SubAgentLivenessResolver.d.ts.map