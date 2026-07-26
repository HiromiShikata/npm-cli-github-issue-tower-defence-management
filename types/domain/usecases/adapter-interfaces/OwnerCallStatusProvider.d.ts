export interface OwnerCallStatusProvider {
    listUnansweredOwnerCallEpochSecondsBySessionName: (transcriptPathBySessionName: Map<string, string>) => Promise<Map<string, number>>;
}
//# sourceMappingURL=OwnerCallStatusProvider.d.ts.map