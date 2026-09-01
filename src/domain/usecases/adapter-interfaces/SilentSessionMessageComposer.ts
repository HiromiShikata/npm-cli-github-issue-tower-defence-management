import { SubAgentActivity } from '../../entities/LiveSessionActivitySnapshot';

export type SubAgentStallSections = {
  idleSubAgents: SubAgentActivity[];
  longRunningSubAgents: SubAgentActivity[];
};

export interface SilentSessionMessageComposer {
  composeSubAgentSection: (sections: SubAgentStallSections) => string;
  composeSubAgentUnconsumedResultSection: (
    unconsumedResultSubAgents: SubAgentActivity[],
  ) => string;
}
