import { Project } from '../../entities/Project';

export interface AgentDefaultRepository {
  setAgentFieldDefault(project: Project, agentName: string): Promise<void>;
}
