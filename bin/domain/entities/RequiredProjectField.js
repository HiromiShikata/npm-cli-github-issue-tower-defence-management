"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_PROJECT_FIELDS = exports.DEPENDED_ISSUE_URL_FIELD_NAME = exports.NEXT_ACTION_HOUR_FIELD_NAME = exports.NEXT_ACTION_DATE_FIELD_NAME = exports.STORY_FIELD_NAME = void 0;
const storyOption = (name, color) => ({ name, color, description: '' });
const REQUIRED_STORY_OPTIONS = [
    storyOption('regular / NO STORY', 'RED'),
    storyOption('regular / WORKFLOW BLOCKER', 'RED'),
    storyOption('regular / high priority', 'RED'),
    storyOption('regular / workflow management', 'YELLOW'),
    storyOption('regular / routine management', 'YELLOW'),
    storyOption('regular / middle bug', 'GRAY'),
    storyOption('regular / minor bug', 'GRAY'),
    storyOption('regular / refactor', 'GRAY'),
    storyOption('regular / backlog', 'GRAY'),
];
const REQUIRED_NEXT_ACTION_HOUR_OPTIONS = Array.from({ length: 23 }, (_, index) => ({
    name: `${index + 1}`,
    color: 'GRAY',
    description: '',
}));
exports.STORY_FIELD_NAME = 'Story';
exports.NEXT_ACTION_DATE_FIELD_NAME = 'Next Action Date';
exports.NEXT_ACTION_HOUR_FIELD_NAME = 'Next Action Hour';
exports.DEPENDED_ISSUE_URL_FIELD_NAME = 'Depended Issue URL separated by comma';
exports.REQUIRED_PROJECT_FIELDS = [
    {
        name: exports.STORY_FIELD_NAME,
        dataType: 'SINGLE_SELECT',
        options: REQUIRED_STORY_OPTIONS,
    },
    {
        name: exports.NEXT_ACTION_DATE_FIELD_NAME,
        dataType: 'DATE',
        options: [],
    },
    {
        name: exports.NEXT_ACTION_HOUR_FIELD_NAME,
        dataType: 'SINGLE_SELECT',
        options: REQUIRED_NEXT_ACTION_HOUR_OPTIONS,
    },
    {
        name: exports.DEPENDED_ISSUE_URL_FIELD_NAME,
        dataType: 'TEXT',
        options: [],
    },
];
//# sourceMappingURL=RequiredProjectField.js.map