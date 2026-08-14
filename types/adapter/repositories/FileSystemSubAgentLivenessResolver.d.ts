import { SubAgentLivenessResolver } from '../../domain/usecases/adapter-interfaces/SubAgentLivenessResolver';
export declare class FileSystemSubAgentLivenessResolver implements SubAgentLivenessResolver {
    private readonly runtimeRootDirectory;
    constructor(runtimeRootDirectory: string | null);
    resolveLiveSubAgentIds: (params: {
        sessionName: string;
        mainTranscriptPath: string | null;
    }) => Promise<Set<string> | null>;
    private resolveRunningSubAgentsFilePath;
}
//# sourceMappingURL=FileSystemSubAgentLivenessResolver.d.ts.map