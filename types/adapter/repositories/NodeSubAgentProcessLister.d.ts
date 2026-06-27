import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { SubAgentProcess, SubAgentProcessLister } from '../../domain/usecases/adapter-interfaces/SubAgentProcessLister';
export declare class NodeSubAgentProcessLister implements SubAgentProcessLister {
    private readonly localCommandRunner;
    constructor(localCommandRunner: LocalCommandRunner);
    listProcesses: () => Promise<SubAgentProcess[]>;
}
//# sourceMappingURL=NodeSubAgentProcessLister.d.ts.map