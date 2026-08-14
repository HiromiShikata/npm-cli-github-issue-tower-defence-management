import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
export declare const ownerCallMarkerFamilyResolve: (marker: string) => string[];
export declare class TranscriptOwnerCallStatusProvider implements OwnerCallStatusProvider {
    private readonly ownerReplyMarkerDirectory;
    private readonly ownerCallMarkerFamily;
    private readonly transcriptScanByPath;
    constructor(ownerCallMarker: string | null, ownerReplyMarkerDirectory?: string | null);
    listUnansweredOwnerCallEpochSecondsBySessionName: (transcriptPathBySessionName: Map<string, string>) => Promise<Map<string, number>>;
    private scanTranscript;
    private readTranscriptScan;
    private resolveReplyEpochMs;
    private findUnansweredOwnerCallEpochMs;
    private readOwnerReplyMarkerEpochMs;
    private isCallSuppressedUndelivered;
    private isCandidateCallDelivered;
    private readMarkerEpochMs;
}
//# sourceMappingURL=TranscriptOwnerCallStatusProvider.d.ts.map