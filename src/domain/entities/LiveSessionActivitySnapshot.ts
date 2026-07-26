export type SubAgentActivity = {
  label: string;
  silentSeconds: number;
  runningSeconds: number;
  waitingOnExternalProcess: boolean;
};

export type LiveSessionActivitySnapshot = {
  sessionName: string;
  mainSilentSeconds: number | null;
  subAgents: SubAgentActivity[];
  unansweredOwnerCallAgeSeconds: number | null;
};
