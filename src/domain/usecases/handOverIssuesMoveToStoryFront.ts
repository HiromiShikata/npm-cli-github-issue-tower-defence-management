import type { Issue } from '../entities/Issue';

export const handOverIssuesMoveToStoryFront = (
  storiedIssues: Issue[],
  handOverIssueUrls: ReadonlySet<string>,
): Issue[] => {
  const issuesByStoryGroupKey = new Map<string, Issue[]>();
  const storyGroupKeysInFirstAppearanceOrder: string[] = [];
  for (const issue of storiedIssues) {
    const storyGroupKey = issue.storyOptionId ?? issue.story ?? '';
    const issuesInStoryGroup = issuesByStoryGroupKey.get(storyGroupKey);
    if (issuesInStoryGroup === undefined) {
      issuesByStoryGroupKey.set(storyGroupKey, [issue]);
      storyGroupKeysInFirstAppearanceOrder.push(storyGroupKey);
    } else {
      issuesInStoryGroup.push(issue);
    }
  }
  return storyGroupKeysInFirstAppearanceOrder.flatMap((storyGroupKey) => {
    const issuesInStoryGroup = issuesByStoryGroupKey.get(storyGroupKey) ?? [];
    const handOverIssuesInStoryGroup = issuesInStoryGroup.filter((issue) =>
      handOverIssueUrls.has(issue.url),
    );
    const nonHandOverIssuesInStoryGroup = issuesInStoryGroup.filter(
      (issue) => !handOverIssueUrls.has(issue.url),
    );
    return [...handOverIssuesInStoryGroup, ...nonHandOverIssuesInStoryGroup];
  });
};
