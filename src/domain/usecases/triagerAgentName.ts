export const TRIAGER_AGENT_NAME = 'triager';
export const PR_REVIEWER_AGENT_NAME = 'pr-reviewer';

export const isTriagerAgentName = (agentName: string | null): boolean =>
  agentName !== null && agentName.trim().toLowerCase() === TRIAGER_AGENT_NAME;
