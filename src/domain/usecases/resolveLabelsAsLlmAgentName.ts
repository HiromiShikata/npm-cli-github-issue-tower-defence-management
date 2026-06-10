export const resolveLabelsAsLlmAgentName = (source: {
  topLevel?: string[] | null;
  startPreparation?: string[] | null;
}): string[] => {
  return source.topLevel ?? source.startPreparation ?? [];
};
