import { SubAgentActivity } from '../../entities/LiveSessionActivitySnapshot';
export interface SilentSessionMessageComposer {
    composeMainStalledSection: (mainSilentSeconds: number) => string;
    composeSubAgentSection: (subAgents: SubAgentActivity[]) => string;
}
//# sourceMappingURL=SilentSessionMessageComposer.d.ts.map