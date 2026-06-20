"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateConsoleListsUseCase = void 0;
const WorkflowStatus_1 = require("../../entities/WorkflowStatus");
const UNKNOWN_STORY_SORT_INDEX = 999999;
class GenerateConsoleListsUseCase {
    constructor() {
        this.run = (input) => {
            const { project, issues, pjcode, assigneeLogin, generatedAt } = input;
            const storyOptions = project.story ? project.story.stories : [];
            const storyOrder = storyOptions.map((option) => option.name);
            const statusOptions = project.status.statuses;
            const actionableIssues = issues.filter((issue) => this.isActionable(issue, assigneeLogin));
            const buildStatusTab = (selector, excludedStatusNames) => ({
                pjcode,
                generatedAt,
                statusOptions: this.buildFieldOptions(statusOptions, excludedStatusNames),
                storyOrder,
                storyColors: this.buildStoryColorsObject(storyOptions),
                items: this.sortByStoryOrder(actionableIssues
                    .filter(selector)
                    .map((issue) => this.projectItem(issue)), storyOrder),
            });
            return {
                prs: buildStatusTab((issue) => issue.status !== null &&
                    issue.status.toLowerCase() === 'awaiting quality check', ['awaiting quality check', 'done']),
                unread: buildStatusTab((issue) => issue.status !== null && issue.status.toLowerCase() === 'unread', ['unread', 'done']),
                'failed-preparation': buildStatusTab((issue) => issue.status === 'Failed Preparation', [
                    'failed preparation',
                    'done',
                    'preparation',
                    'icebox',
                    'unread',
                    'in tmux by human',
                    'in tmux by agent',
                ]),
                'todo-by-human': buildStatusTab((issue) => issue.status === WorkflowStatus_1.TODO_STATUS_NAME ||
                    issue.status === WorkflowStatus_1.LEGACY_TODO_STATUS_NAME, [WorkflowStatus_1.TODO_STATUS_NAME.toLowerCase(), 'done']),
                triage: {
                    pjcode,
                    generatedAt,
                    storyOptions: this.buildFieldOptions(storyOptions, []),
                    storyOrder,
                    storyColors: this.buildStoryColorsString(storyOptions),
                    items: this.sortByStoryOrder(actionableIssues
                        .filter((issue) => issue.story !== null &&
                        issue.story.toLowerCase().includes('no story'))
                        .map((issue) => this.projectItem(issue)), storyOrder),
                },
            };
        };
        this.isActionable = (issue, assigneeLogin) => issue.isClosed === false &&
            issue.assignees.includes(assigneeLogin) &&
            issue.dependedIssueUrls.length === 0 &&
            issue.nextActionDate === null &&
            issue.nextActionHour === null;
        this.projectItem = (issue) => ({
            number: issue.number,
            title: issue.title,
            url: issue.url,
            repo: issue.nameWithOwner,
            nameWithOwner: issue.nameWithOwner,
            projectItemId: issue.itemId,
            itemId: issue.itemId,
            isPr: issue.isPr,
            story: issue.story ?? '',
            labels: issue.labels,
            createdAt: issue.createdAt.toISOString(),
        });
        this.buildFieldOptions = (options, excludedLowerCaseNames) => options
            .filter((option) => !excludedLowerCaseNames.includes(option.name.toLowerCase()))
            .map((option) => ({
            id: option.id,
            name: option.name,
            color: option.color,
        }));
        this.buildStoryColorsObject = (options) => {
            const result = {};
            for (const option of options) {
                result[option.name] = { color: option.color };
            }
            return result;
        };
        this.buildStoryColorsString = (options) => {
            const result = {};
            for (const option of options) {
                result[option.name] = option.color;
            }
            return result;
        };
        this.sortByStoryOrder = (items, storyOrder) => {
            const indexByStory = new Map(storyOrder.map((name, index) => [name, index]));
            return items
                .map((item, position) => ({
                item,
                position,
                sortKey: indexByStory.get(item.story) ?? UNKNOWN_STORY_SORT_INDEX,
            }))
                .sort((a, b) => a.sortKey - b.sortKey || a.position - b.position)
                .map((entry) => entry.item);
        };
    }
}
exports.GenerateConsoleListsUseCase = GenerateConsoleListsUseCase;
//# sourceMappingURL=GenerateConsoleListsUseCase.js.map