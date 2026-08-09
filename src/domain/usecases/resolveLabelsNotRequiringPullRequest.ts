export const resolveLabelsNotRequiringPullRequest = (source: {
  labelsAsLlmAgentName?: string[] | null;
  labelsNotRequiringPullRequest?: string[] | null;
}): string[] => [
  ...(source.labelsAsLlmAgentName ?? []),
  ...(source.labelsNotRequiringPullRequest ?? []),
];
