import { SubAgentActivity } from '../../entities/LiveSessionActivitySnapshot';

export type SubAgentStallThresholds = {
  subAgentSilentThresholdSeconds: number;
  subAgentRunningThresholdSeconds: number;
};

export interface SilentSessionMessageComposer {
  composeMainStalledSection: (mainSilentSeconds: number) => string;
  composeSubAgentSection: (
    subAgents: SubAgentActivity[],
    thresholds: SubAgentStallThresholds,
  ) => string;
}
