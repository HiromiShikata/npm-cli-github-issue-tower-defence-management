import { SubAgentActivity } from '../../entities/LiveSessionActivitySnapshot';
export type SubAgentStallSections = {
    idleSubAgents: SubAgentActivity[];
    longRunningSubAgents: SubAgentActivity[];
};
export interface SilentSessionMessageComposer {
    composeMainStalledSection: (mainSilentSeconds: number) => string;
    composeSubAgentSection: (sections: SubAgentStallSections) => string;
}
//# sourceMappingURL=SilentSessionMessageComposer.d.ts.map