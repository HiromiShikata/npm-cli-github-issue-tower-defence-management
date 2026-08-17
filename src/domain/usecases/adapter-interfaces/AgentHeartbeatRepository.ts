export interface AgentHeartbeatRepository {
  readHeartbeatEpochSeconds: (issueUrl: string) => Promise<number | null>;
  writeHeartbeat: (issueUrl: string, nowEpochSeconds: number) => Promise<void>;
}
