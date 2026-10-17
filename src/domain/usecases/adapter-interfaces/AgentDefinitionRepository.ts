export interface AgentDefinitionRepository {
  getLlmModelName: (agentName: string) => Promise<string | null>;
}
