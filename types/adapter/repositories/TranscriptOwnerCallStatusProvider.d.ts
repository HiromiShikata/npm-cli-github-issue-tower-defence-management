import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
import { UnansweredOwnerCall } from '../../domain/entities/UnansweredOwnerCall';
export declare const ownerCallMarkerFamilyResolve: (marker: string) => string[];
export declare class TranscriptOwnerCallStatusProvider implements OwnerCallStatusProvider {
    private readonly ownerReplyMarkerDirectory;
    private readonly ownerCallMarkerFamily;
    constructor(ownerCallMarker: string | null, ownerReplyMarkerDirectory?: string | null);
    listUnansweredOwnerCallEpochSecondsBySessionName: (transcriptPathBySessionName: Map<string, string>) => Promise<Map<string, number>>;
    listUnansweredOwnerCallsBySessionName: (transcriptPathBySessionName: Map<string, string>) => Promise<Map<string, UnansweredOwnerCall[]>>;
    private scanTranscript;
    private resolveReplyEpochMs;
    private findUnansweredOwnerCallEpochMs;
    private readOwnerReplyMarkerEpochMs;
    private isCallDeliveredToOwner;
    private isCallSuppressedUndelivered;
    private isCandidateCallDelivered;
    private readMarkerEpochMs;
}
//# sourceMappingURL=TranscriptOwnerCallStatusProvider.d.ts.map