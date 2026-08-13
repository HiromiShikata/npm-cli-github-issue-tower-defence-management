"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveUnansweredOwnerCallsByTmuxSessionName = void 0;
const ResolveInteractiveLiveSessionsUseCase_1 = require("../../../domain/usecases/ResolveInteractiveLiveSessionsUseCase");
const resolveUnansweredOwnerCallsByTmuxSessionName = async (params) => {
    const snapshot = await params.liveSessionProcessSnapshotProvider.getSnapshot();
    const interactiveSessions = new ResolveInteractiveLiveSessionsUseCase_1.ResolveInteractiveLiveSessionsUseCase().resolve(snapshot);
    const transcriptPathBySessionName = params.interactiveLiveSessionTranscriptResolver.resolveTranscriptPaths(interactiveSessions);
    return params.unansweredOwnerCallListProvider.listUnansweredOwnerCallsBySessionName(transcriptPathBySessionName);
};
exports.resolveUnansweredOwnerCallsByTmuxSessionName = resolveUnansweredOwnerCallsByTmuxSessionName;
//# sourceMappingURL=resolveUnansweredOwnerCalls.js.map