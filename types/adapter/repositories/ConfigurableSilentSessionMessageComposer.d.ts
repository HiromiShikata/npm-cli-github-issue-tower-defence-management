import { SilentSessionMessageComposer, SubAgentStallSections } from '../../domain/usecases/adapter-interfaces/SilentSessionMessageComposer';
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
    private readonly ownerCallMarker;
    constructor(templates: SilentSessionMessageTemplates, fallback: SilentSessionMessageComposer, ownerCallMarker?: string | null);
    composeMainStalledSection: (mainSilentSeconds: number) => string;
    composeSubAgentSection: (stallSections: SubAgentStallSections) => string;
    private composeIdleSection;
    private composeLongRunningSection;
}
//# sourceMappingURL=ConfigurableSilentSessionMessageComposer.d.ts.map