export type ClaudeLiveSession = {
  token: string;
  sessionId: string;
};

export interface ClaudeLiveSessionRepository {
  listLiveSessions: () => ClaudeLiveSession[];
}
