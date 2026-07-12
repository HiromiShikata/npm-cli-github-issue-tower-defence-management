export interface SilentSessionCandidateStateRepository {
  loadRecentCandidateSessionNames: (params: {
    now: Date;
    recencyWindowSeconds: number;
  }) => Promise<Set<string>>;
  saveCandidateSessionNames: (params: {
    sessionNames: string[];
    now: Date;
  }) => Promise<void>;
  loadAnnouncedRunningSubAgentLabels: (params: {
    sessionName: string;
  }) => Promise<Set<string>>;
  saveAnnouncedRunningSubAgentLabels: (params: {
    sessionName: string;
    labels: string[];
    now: Date;
  }) => Promise<void>;
}
