import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
export declare const ownerCallMarkerFamilyResolve: (marker: string) => string[];
export declare class TranscriptOwnerCallStatusProvider implements OwnerCallStatusProvider {
    private readonly ownerReplyMarkerDirectory;
    private readonly ownerCallMarkerFamily;
    constructor(ownerCallMarker: string | null, ownerReplyMarkerDirectory?: string | null);
    listUnansweredOwnerCallEpochSecondsBySessionName: (transcriptPathBySessionName: Map<string, string>) => Promise<Map<string, number>>;
    private findUnansweredOwnerCallEpochMs;
    private readOwnerReplyMarkerEpochMs;
}
//# sourceMappingURL=TranscriptOwnerCallStatusProvider.d.ts.map