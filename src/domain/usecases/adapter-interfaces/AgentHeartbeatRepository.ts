export interface AgentHeartbeatRepository {
  readHeartbeatEpochSeconds: (issueUrl: string) => Promise<number | null>;
  writeHeartbeat: (issueUrl: string, nowEpochSeconds: number) => Promise<void>;
  readOrphanCandidateEpochSeconds: (issueUrl: string) => Promise<number | null>;
  writeOrphanCandidate: (
    issueUrl: string,
    nowEpochSeconds: number,
  ) => Promise<void>;
  deleteOrphanCandidate: (issueUrl: string) => Promise<void>;
}
