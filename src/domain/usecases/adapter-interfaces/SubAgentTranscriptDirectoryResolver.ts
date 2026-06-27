export interface SubAgentTranscriptDirectoryResolver {
  resolveSubAgentsDirectory: (sessionName: string) => string | null;
}
