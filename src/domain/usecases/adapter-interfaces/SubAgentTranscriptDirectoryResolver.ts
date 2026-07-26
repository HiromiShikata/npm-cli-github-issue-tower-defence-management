export interface SubAgentTranscriptDirectoryResolver {
  resolveSubAgentsDirectory: (
    sessionName: string,
    mainTranscriptPath: string | null,
  ) => string | null;
}
