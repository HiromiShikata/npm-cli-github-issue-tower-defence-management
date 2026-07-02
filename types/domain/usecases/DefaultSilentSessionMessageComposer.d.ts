import { SubAgentActivity } from '../entities/LiveSessionActivitySnapshot';
import { SilentSessionMessageComposer, SubAgentStallThresholds } from './adapter-interfaces/SilentSessionMessageComposer';
export declare const composeOwnerCallFormatGuidance: (ownerCallMarker: string | null) => string;
export declare class DefaultSilentSessionMessageComposer implements SilentSessionMessageComposer {
    private readonly ownerCallMarker;
    constructor(ownerCallMarker?: string | null);
    composeMainStalledSection: (mainSilentSeconds: number) => string;
    composeSubAgentSection: (subAgents: SubAgentActivity[], thresholds: SubAgentStallThresholds) => string;
}
//# sourceMappingURL=DefaultSilentSessionMessageComposer.d.ts.map