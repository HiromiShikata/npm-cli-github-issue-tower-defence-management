"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateInTmuxByHumanDataUseCase = void 0;
const IN_TMUX_BY_HUMAN_STATUS_NAME = 'In Tmux by human';
const UNKNOWN_STORY_SORT_INDEX = 999999;
class GenerateInTmuxByHumanDataUseCase {
    constructor() {
        this.run = (input) => {
            const { project, issues, pjcode, assigneeLogin, org, repo, consoleBaseUrl, consoleToken, now, } = input;
            const storyOrder = project.story
                ? project.story.stories.map((option) => option.name)
                : [];
            const selectedIssues = issues.filter((issue) => this.isInTmuxByHuman(issue, assigneeLogin, now));
            const groups = this.groupByStoryOrder(selectedIssues, storyOrder);
            const v2 = groups.map((group) => ({
                story: group.story,
                urls: group.issues.map((issue) => ({
                    url: issue.url,
                    title: issue.title,
                })),
            }));
            const v1 = groups.map((group) => ({
                story: group.story,
                urls: group.issues.map((issue) => issue.url),
            }));
            const v4Groups = groups.map((group) => ({
                story: group.story,
                sessions: group.issues.map((issue) => ({
                    name: issue.url,
                    description: issue.title,
                })),
            }));
            const overviewUrl = project.url;
            const tdpmConsoleUrl = consoleBaseUrl
                ? `${consoleBaseUrl}/projects/${pjcode}/prs`
                : null;
            const v3 = tdpmConsoleUrl
                ? {
                    version: 3,
                    overviewUrl,
                    tdpmConsoleUrl,
                    groups: v2,
                }
                : null;
            const v4 = tdpmConsoleUrl && consoleToken
                ? {
                    version: 4,
                    overviewUrl,
                    tdpmConsoleUrl: `${tdpmConsoleUrl}?k=${consoleToken}`,
                    newIssueUrl: `https://github.com/${org}/${repo}/issues/new?assignees=${assigneeLogin}`,
                    groups: v4Groups,
                }
                : null;
            return { v1, v2, v3, v4 };
        };
        this.isInTmuxByHuman = (issue, assigneeLogin, now) => issue.status === IN_TMUX_BY_HUMAN_STATUS_NAME &&
            issue.isClosed === false &&
            issue.assignees.includes(assigneeLogin) &&
            (issue.nextActionDate === null ||
                issue.nextActionDate.getTime() <= now.getTime()) &&
            issue.nextActionHour === null;
        this.groupByStoryOrder = (issues, storyOrder) => {
            const indexByStory = new Map(storyOrder.map((name, index) => [name, index]));
            const issuesByStory = new Map();
            for (const issue of issues) {
                const story = issue.story ?? '';
                const existing = issuesByStory.get(story);
                if (existing) {
                    existing.push(issue);
                }
                else {
                    issuesByStory.set(story, [issue]);
                }
            }
            return [...issuesByStory.entries()]
                .map(([story, groupedIssues]) => ({
                story,
                issues: groupedIssues,
                sortIndex: indexByStory.get(story) ?? UNKNOWN_STORY_SORT_INDEX,
            }))
                .sort((left, right) => left.sortIndex !== right.sortIndex
                ? left.sortIndex - right.sortIndex
                : left.story < right.story
                    ? -1
                    : 1)
                .map(({ story, issues: groupedIssues }) => ({
                story,
                issues: groupedIssues,
            }));
        };
    }
}
exports.GenerateInTmuxByHumanDataUseCase = GenerateInTmuxByHumanDataUseCase;
//# sourceMappingURL=GenerateInTmuxByHumanDataUseCase.js.map