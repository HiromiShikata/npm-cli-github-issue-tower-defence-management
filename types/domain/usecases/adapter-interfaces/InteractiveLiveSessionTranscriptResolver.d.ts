import { InteractiveLiveSession } from '../../entities/InteractiveLiveSession';
export interface InteractiveLiveSessionTranscriptResolver {
    resolveTranscriptPaths: (sessions: InteractiveLiveSession[]) => Map<string, string>;
}
//# sourceMappingURL=InteractiveLiveSessionTranscriptResolver.d.ts.map