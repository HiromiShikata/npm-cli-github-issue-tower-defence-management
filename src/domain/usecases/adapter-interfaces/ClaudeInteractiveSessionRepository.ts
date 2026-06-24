export type ClaudeInteractiveSession = {
  token: string;
  sessionId: string;
  issueUrl: string;
};

export interface ClaudeInteractiveSessionRepository {
  listInteractiveSessions: () => ClaudeInteractiveSession[];
}
