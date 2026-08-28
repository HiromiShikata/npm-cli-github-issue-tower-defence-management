"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStoryListWithNew = exports.FIELD_OPTION_COLORS = void 0;
exports.FIELD_OPTION_COLORS = [
    'GRAY',
    'BLUE',
    'GREEN',
    'YELLOW',
    'ORANGE',
    'RED',
    'PINK',
    'PURPLE',
];
const buildStoryListWithNew = (existingStories, newName) => {
    if (existingStories.some((s) => s.name === newName)) {
        return [...existingStories];
    }
    const newEntry = {
        id: null,
        name: newName,
        color: 'RED',
        description: '',
    };
    if (existingStories.length === 0) {
        return [newEntry];
    }
    return [existingStories[0], newEntry, ...existingStories.slice(1)];
};
exports.buildStoryListWithNew = buildStoryListWithNew;
//# sourceMappingURL=Project.js.map