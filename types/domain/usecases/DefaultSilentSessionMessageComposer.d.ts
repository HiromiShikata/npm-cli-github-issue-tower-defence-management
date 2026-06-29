import { SubAgentActivity } from '../entities/LiveSessionActivitySnapshot';
import { SilentSessionMessageComposer } from './adapter-interfaces/SilentSessionMessageComposer';
export declare class DefaultSilentSessionMessageComposer implements SilentSessionMessageComposer {
    private readonly ownerCallMarker;
    constructor(ownerCallMarker?: string | null);
    composeMainStalledSection: (mainSilentSeconds: number) => string;
    composeSubAgentSection: (subAgents: SubAgentActivity[]) => string;
}
//# sourceMappingURL=DefaultSilentSessionMessageComposer.d.ts.map