import { SubAgentTranscriptDirectoryResolver } from '../../domain/usecases/adapter-interfaces/SubAgentTranscriptDirectoryResolver';
export declare class FileSystemSubAgentTranscriptDirectoryResolver implements SubAgentTranscriptDirectoryResolver {
    private readonly rootDirectory;
    constructor(rootDirectory: string | null);
    resolveSubAgentsDirectory: (_sessionName: string, mainTranscriptPath: string | null) => string | null;
}
//# sourceMappingURL=FileSystemSubAgentTranscriptDirectoryResolver.d.ts.map