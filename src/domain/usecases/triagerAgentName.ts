export const TRIAGER_AGENT_NAME = 'triager';

export const isTriagerAgentName = (agentName: string | null): boolean =>
  agentName !== null && agentName.trim().toLowerCase() === TRIAGER_AGENT_NAME;
