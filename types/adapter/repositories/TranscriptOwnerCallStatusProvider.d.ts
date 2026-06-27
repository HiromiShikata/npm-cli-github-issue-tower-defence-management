import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
export declare class TranscriptOwnerCallStatusProvider implements OwnerCallStatusProvider {
    private readonly ownerCallMarker;
    constructor(ownerCallMarker: string | null);
    listSessionNamesWithUnansweredOwnerCall: (transcriptPathBySessionName: Map<string, string>) => Promise<Set<string>>;
    private isWaitingForOwnerReply;
}
//# sourceMappingURL=TranscriptOwnerCallStatusProvider.d.ts.map