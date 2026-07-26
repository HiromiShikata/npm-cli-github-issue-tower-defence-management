import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
export declare class TranscriptOwnerCallStatusProvider implements OwnerCallStatusProvider {
    private readonly ownerCallMarker;
    constructor(ownerCallMarker: string | null);
    listUnansweredOwnerCallEpochSecondsBySessionName: (transcriptPathBySessionName: Map<string, string>) => Promise<Map<string, number>>;
    private findUnansweredOwnerCallEpochMs;
}
//# sourceMappingURL=TranscriptOwnerCallStatusProvider.d.ts.map