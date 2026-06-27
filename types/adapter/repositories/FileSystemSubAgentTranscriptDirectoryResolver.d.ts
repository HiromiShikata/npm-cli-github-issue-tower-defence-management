import { SubAgentTranscriptDirectoryResolver } from '../../domain/usecases/adapter-interfaces/SubAgentTranscriptDirectoryResolver';
export declare class FileSystemSubAgentTranscriptDirectoryResolver implements SubAgentTranscriptDirectoryResolver {
    private readonly rootDirectory;
    constructor(rootDirectory: string | null);
    resolveSubAgentsDirectory: (sessionName: string) => string | null;
}
//# sourceMappingURL=FileSystemSubAgentTranscriptDirectoryResolver.d.ts.map