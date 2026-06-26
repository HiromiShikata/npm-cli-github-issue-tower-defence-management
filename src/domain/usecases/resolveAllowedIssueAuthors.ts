export const resolveAllowedIssueAuthors = (source: {
  topLevel?: string[] | null;
  startPreparation?: string[] | null;
}): string[] | null => {
  return source.topLevel ?? source.startPreparation ?? null;
};
