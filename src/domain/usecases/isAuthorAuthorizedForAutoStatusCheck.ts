export const isAuthorAuthorizedForAutoStatusCheck = (
  author: string,
  allowedIssueAuthors: string[] | null | undefined,
): boolean => {
  if (allowedIssueAuthors === null || allowedIssueAuthors === undefined) {
    return false;
  }
  if (allowedIssueAuthors.length === 0) {
    return false;
  }
  return allowedIssueAuthors.includes(author);
};
