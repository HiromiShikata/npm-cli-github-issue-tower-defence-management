import { UnansweredOwnerCall } from '../../../domain/entities/UnansweredOwnerCall';
import { InteractiveLiveSession } from '../../../domain/entities/InteractiveLiveSession';
import { ResolveInteractiveLiveSessionsUseCase } from '../../../domain/usecases/ResolveInteractiveLiveSessionsUseCase';
import { LiveSessionProcessSnapshotProvider } from '../../../domain/usecases/adapter-interfaces/LiveSessionProcessSnapshotProvider';
import { InteractiveLiveSessionTranscriptResolver } from '../../../domain/usecases/adapter-interfaces/InteractiveLiveSessionTranscriptResolver';

export type UnansweredOwnerCallListProvider = {
  listUnansweredOwnerCallsBySessionName: (
    transcriptPathBySessionName: Map<string, string>,
  ) => Promise<Map<string, UnansweredOwnerCall[]>>;
};

export type ResolveUnansweredOwnerCallsParams = {
  liveSessionProcessSnapshotProvider: LiveSessionProcessSnapshotProvider;
  interactiveLiveSessionTranscriptResolver: InteractiveLiveSessionTranscriptResolver;
  unansweredOwnerCallListProvider: UnansweredOwnerCallListProvider;
};

export const resolveUnansweredOwnerCallsByTmuxSessionName = async (
  params: ResolveUnansweredOwnerCallsParams,
): Promise<Map<string, UnansweredOwnerCall[]>> => {
  const snapshot =
    await params.liveSessionProcessSnapshotProvider.getSnapshot();
  const interactiveSessions: InteractiveLiveSession[] =
    new ResolveInteractiveLiveSessionsUseCase().resolve(snapshot);
  const transcriptPathBySessionName =
    params.interactiveLiveSessionTranscriptResolver.resolveTranscriptPaths(
      interactiveSessions,
    );
  return params.unansweredOwnerCallListProvider.listUnansweredOwnerCallsBySessionName(
    transcriptPathBySessionName,
  );
};
