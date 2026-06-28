export type LiveSessionPaneProcess = {
  sessionName: string;
  panePids: number[];
};

export type LiveSessionProcessInfo = {
  pid: number;
  ppid: number;
  commandLine: string;
  sessionId: string | null;
  currentSessionId: string | null;
  configDir: string | null;
};

export type LiveSessionProcessSnapshot = {
  sessions: LiveSessionPaneProcess[];
  processes: LiveSessionProcessInfo[];
};
