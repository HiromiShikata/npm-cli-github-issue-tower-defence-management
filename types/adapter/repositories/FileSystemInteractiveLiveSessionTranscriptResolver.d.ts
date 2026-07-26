import { InteractiveLiveSession } from '../../domain/entities/InteractiveLiveSession';
import { InteractiveLiveSessionTranscriptResolver } from '../../domain/usecases/adapter-interfaces/InteractiveLiveSessionTranscriptResolver';
export declare class FileSystemInteractiveLiveSessionTranscriptResolver implements InteractiveLiveSessionTranscriptResolver {
    private readonly sharedProjectsDirectory;
    constructor(sharedProjectsDirectory?: string);
    resolveTranscriptPaths: (sessions: InteractiveLiveSession[]) => Map<string, string>;
    private resolveTranscriptPath;
    private resolveCandidateTranscriptPath;
    private listProjectsDirectories;
    private listCandidatePaths;
}
//# sourceMappingURL=FileSystemInteractiveLiveSessionTranscriptResolver.d.ts.map