import { SubAgentActivity } from '../../domain/entities/LiveSessionActivitySnapshot';
import { SilentSessionMessageComposer } from '../../domain/usecases/adapter-interfaces/SilentSessionMessageComposer';
export type SilentSessionMessageTemplates = {
    mainStalledMessage: string | null;
    subAgentMessageHeader: string | null;
    subAgentMessageFooter: string | null;
};
export declare class ConfigurableSilentSessionMessageComposer implements SilentSessionMessageComposer {
    private readonly templates;
    private readonly fallback;
    constructor(templates: SilentSessionMessageTemplates, fallback: SilentSessionMessageComposer);
    composeMainStalledSection: (mainSilentSeconds: number) => string;
    composeSubAgentSection: (subAgents: SubAgentActivity[]) => string;
}
//# sourceMappingURL=ConfigurableSilentSessionMessageComposer.d.ts.map