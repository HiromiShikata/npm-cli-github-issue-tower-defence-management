export type PendingOwnerCall = {
  sessionName: string;
  calledAt: string;
};

export interface OwnerCallFileRepository {
  listPendingOwnerCalls: () => PendingOwnerCall[];
}

export type SessionHost =
  | { kind: 'local' }
  | {
      kind: 'remote';
      name: string;
      address: string;
      port: number;
      user: string;
    }
  | { kind: 'unknownRemote'; name: string };

export interface SessionHostRepository {
  findHostOfIssueSession: (issueUrl: string) => SessionHost;
}

export type SessionReadCommand =
  | { kind: 'tmuxHasSession'; sessionName: string }
  | { kind: 'tmuxCapturePane'; sessionName: string }
  | { kind: 'tmuxPanePath'; sessionName: string }
  | { kind: 'realPath'; path: string }
  | { kind: 'fileType'; path: string }
  | { kind: 'readFileHead'; path: string; byteLimit: number }
  | { kind: 'listDirectory'; path: string };

export type SessionReadCommandResult =
  | { kind: 'exited'; exitCode: number; stdout: string }
  | { kind: 'unreachable' };

export interface SessionCommandRepository {
  run: (
    host: SessionHost,
    command: SessionReadCommand,
  ) => Promise<SessionReadCommandResult>;
}
