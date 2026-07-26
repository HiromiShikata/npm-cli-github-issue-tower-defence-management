import { SubAgentActivity } from '../../domain/entities/LiveSessionActivitySnapshot';
import { SessionSubAgentActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionSubAgentActivityRepository';
import { SubAgentProcessLister } from '../../domain/usecases/adapter-interfaces/SubAgentProcessLister';
import { SubAgentSilentSecondsResolver } from '../../domain/usecases/adapter-interfaces/SubAgentSilentSecondsResolver';
export declare class ProcessListSessionSubAgentActivityRepository implements SessionSubAgentActivityRepository {
    private readonly processLister;
    private readonly silentSecondsResolver;
    private readonly matchRegExp;
    constructor(matchPattern: string | null, processLister: SubAgentProcessLister, silentSecondsResolver: SubAgentSilentSecondsResolver);
    listSubAgentActivitiesBySessionName: (sessionNames: string[]) => Promise<Map<string, SubAgentActivity[]>>;
}
//# sourceMappingURL=ProcessListSessionSubAgentActivityRepository.d.ts.map