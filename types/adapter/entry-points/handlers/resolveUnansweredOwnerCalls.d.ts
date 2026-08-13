import { UnansweredOwnerCall } from '../../../domain/entities/UnansweredOwnerCall';
import { LiveSessionProcessSnapshotProvider } from '../../../domain/usecases/adapter-interfaces/LiveSessionProcessSnapshotProvider';
import { InteractiveLiveSessionTranscriptResolver } from '../../../domain/usecases/adapter-interfaces/InteractiveLiveSessionTranscriptResolver';
export type UnansweredOwnerCallListProvider = {
    listUnansweredOwnerCallsBySessionName: (transcriptPathBySessionName: Map<string, string>) => Promise<Map<string, UnansweredOwnerCall[]>>;
};
export type ResolveUnansweredOwnerCallsParams = {
    liveSessionProcessSnapshotProvider: LiveSessionProcessSnapshotProvider;
    interactiveLiveSessionTranscriptResolver: InteractiveLiveSessionTranscriptResolver;
    unansweredOwnerCallListProvider: UnansweredOwnerCallListProvider;
};
export declare const resolveUnansweredOwnerCallsByTmuxSessionName: (params: ResolveUnansweredOwnerCallsParams) => Promise<Map<string, UnansweredOwnerCall[]>>;
//# sourceMappingURL=resolveUnansweredOwnerCalls.d.ts.map