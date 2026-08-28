export type ClaudeHandoverSessionKind =
  'issueUrlLeader' | 'bareNameLeader' | 'implSubagent';

export type ClaudeHandoverSession = {
  kind: ClaudeHandoverSessionKind;
  pid: number;
  token: string;
  sessionName: string | null;
  name: string | null;
  issueUrl: string | null;
  runsUnderWorkspacePreparationScript: boolean;
};
