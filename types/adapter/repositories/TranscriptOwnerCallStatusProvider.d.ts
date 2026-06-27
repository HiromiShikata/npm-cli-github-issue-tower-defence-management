import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
export declare class TranscriptOwnerCallStatusProvider implements OwnerCallStatusProvider {
    private readonly rootDirectory;
    private readonly ownerCallMarker;
    constructor(rootDirectory: string | null, ownerCallMarker: string | null);
    listSessionNamesWithUnansweredOwnerCall: (sessionNames: string[]) => Promise<Set<string>>;
    private isWaitingForOwnerReply;
    private toTranscriptFileName;
}
//# sourceMappingURL=TranscriptOwnerCallStatusProvider.d.ts.map