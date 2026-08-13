import { SubAgentActivity } from '../entities/LiveSessionActivitySnapshot';
import { SilentSessionMessageComposer, SubAgentStallSections } from './adapter-interfaces/SilentSessionMessageComposer';
export declare const composeOwnerCallFormatGuidance: () => string;
export declare class DefaultSilentSessionMessageComposer implements SilentSessionMessageComposer {
    composeMainStalledSection: (mainSilentSeconds: number) => string;
    composeMainStalledWithStaleOwnerCallSection: (mainSilentSeconds: number, unansweredOwnerCallAgeSeconds: number) => string;
    composeSubAgentSection: (stallSections: SubAgentStallSections) => string;
    composeSubAgentUnconsumedResultSection: (unconsumedResultSubAgents: SubAgentActivity[]) => string;
}
//# sourceMappingURL=DefaultSilentSessionMessageComposer.d.ts.map