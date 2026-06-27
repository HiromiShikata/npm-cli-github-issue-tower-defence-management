import { SubAgentSilentSecondsResolver } from '../../domain/usecases/adapter-interfaces/SubAgentSilentSecondsResolver';
export declare class FileSystemSubAgentSilentSecondsResolver implements SubAgentSilentSecondsResolver {
    private readonly rootDirectory;
    private readonly now;
    constructor(rootDirectory: string | null, now: Date);
    resolveSilentSeconds: (label: string) => number;
    private toFileName;
}
//# sourceMappingURL=FileSystemSubAgentSilentSecondsResolver.d.ts.map