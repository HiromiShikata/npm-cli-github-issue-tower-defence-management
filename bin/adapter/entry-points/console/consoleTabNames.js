"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortByStoryOrder = exports.CONSOLE_LIST_TAB_NAMES = void 0;
exports.CONSOLE_LIST_TAB_NAMES = [
    'workflow-blocker',
    'prs',
    'triage',
    'unread',
    'failed-preparation',
    'todo-by-human',
    'todo-by-agent',
];
const UNKNOWN_STORY_SORT_INDEX = 999999;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sortByStoryOrder = (items, storyOrder) => {
    const indexByStory = new Map(storyOrder.map((name, index) => [name, index]));
    return items
        .map((item, position) => {
        const storyValue = isRecord(item) ? item.story : undefined;
        const story = typeof storyValue === 'string' ? storyValue : undefined;
        return {
            item,
            position,
            sortKey: (story !== undefined ? indexByStory.get(story) : undefined) ??
                UNKNOWN_STORY_SORT_INDEX,
        };
    })
        .sort((a, b) => a.sortKey - b.sortKey || a.position - b.position)
        .map((entry) => entry.item);
};
exports.sortByStoryOrder = sortByStoryOrder;
//# sourceMappingURL=consoleTabNames.js.map