import { SubAgentActivity } from '../../domain/entities/LiveSessionActivitySnapshot';
import { SilentSessionMessageComposer, SubAgentStallThresholds } from '../../domain/usecases/adapter-interfaces/SilentSessionMessageComposer';
export type SilentSessionMessageTemplates = {
    mainStalledMessage: string | null;
    subAgentIdleMessageHeader: string | null;
    subAgentIdleMessageFooter: string | null;
    subAgentLongRunningMessageHeader: string | null;
    subAgentLongRunningMessageFooter: string | null;
};
export declare class ConfigurableSilentSessionMessageComposer implements SilentSessionMessageComposer {
    private readonly templates;
    private readonly fallback;
    constructor(templates: SilentSessionMessageTemplates, fallback: SilentSessionMessageComposer);
    composeMainStalledSection: (mainSilentSeconds: number) => string;
    composeSubAgentSection: (subAgents: SubAgentActivity[], thresholds: SubAgentStallThresholds) => string;
    private composeIdleSection;
    private composeLongRunningSection;
}
//# sourceMappingURL=ConfigurableSilentSessionMessageComposer.d.ts.map