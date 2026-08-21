"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectFromDefinition = exports.convertToFieldOptionColor = void 0;
const RequiredProjectField_1 = require("../../domain/entities/RequiredProjectField");
const utils_1 = require("./utils");
const convertToFieldOptionColor = (color) => {
    switch (color) {
        case 'RED':
        case 'YELLOW':
        case 'GREEN':
        case 'BLUE':
        case 'PURPLE':
        case 'ORANGE':
        case 'PINK':
        case 'GRAY':
            return color;
        default:
            return 'GRAY';
    }
};
exports.convertToFieldOptionColor = convertToFieldOptionColor;
const projectFromDefinition = (definition) => {
    const nextActionDate = definition.fields.find((field) => (0, utils_1.normalizeFieldName)(field.name) ===
        (0, utils_1.normalizeFieldName)(RequiredProjectField_1.NEXT_ACTION_DATE_FIELD_NAME));
    const nextActionHour = definition.fields.find((field) => (0, utils_1.normalizeFieldName)(field.name) ===
        (0, utils_1.normalizeFieldName)(RequiredProjectField_1.NEXT_ACTION_HOUR_FIELD_NAME));
    const status = definition.fields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'status');
    if (!status) {
        throw new Error('status field is not found');
    }
    const story = definition.fields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === (0, utils_1.normalizeFieldName)(RequiredProjectField_1.STORY_FIELD_NAME));
    const workflowManagementStory = story?.options.find((option) => (0, utils_1.normalizeFieldName)(option.name).includes('workflowmanagement'));
    const remainingEstimationMinutes = definition.fields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'remainingestimationminutes');
    const dependedIssueUrlSeparatedByComma = definition.fields.find((field) => (0, utils_1.normalizeFieldName)(field.name).startsWith((0, utils_1.normalizeFieldName)(RequiredProjectField_1.DEPENDED_ISSUE_URL_FIELD_NAME)));
    const completionDate50PercentConfidence = definition.fields.find((field) => (0, utils_1.normalizeFieldName)(field.name).startsWith('completiondate'));
    const agentField = definition.fields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === (0, utils_1.normalizeFieldName)(RequiredProjectField_1.AGENT_FIELD_NAME));
    return {
        id: definition.id,
        url: definition.url,
        databaseId: definition.databaseId,
        name: definition.name,
        status: {
            name: status.name,
            fieldId: status.fieldId,
            statuses: status.options,
        },
        nextActionDate: nextActionDate
            ? {
                name: nextActionDate.name,
                fieldId: nextActionDate.fieldId,
            }
            : null,
        nextActionHour: nextActionHour
            ? {
                name: nextActionHour.name,
                fieldId: nextActionHour.fieldId,
            }
            : null,
        story: story && workflowManagementStory
            ? {
                name: story.name,
                fieldId: story.fieldId,
                databaseId: story.databaseId,
                stories: story.options,
                workflowManagementStory,
            }
            : null,
        remainingEstimationMinutes: remainingEstimationMinutes
            ? {
                name: remainingEstimationMinutes.name,
                fieldId: remainingEstimationMinutes.fieldId,
            }
            : null,
        dependedIssueUrlSeparatedByComma: dependedIssueUrlSeparatedByComma
            ? {
                name: dependedIssueUrlSeparatedByComma.name,
                fieldId: dependedIssueUrlSeparatedByComma.fieldId,
            }
            : null,
        completionDate50PercentConfidence: completionDate50PercentConfidence
            ? {
                name: completionDate50PercentConfidence.name,
                fieldId: completionDate50PercentConfidence.fieldId,
            }
            : null,
        agent: agentField
            ? {
                name: agentField.name,
                fieldId: agentField.fieldId,
                options: agentField.options,
            }
            : null,
    };
};
exports.projectFromDefinition = projectFromDefinition;
//# sourceMappingURL=projectFieldDefinition.js.map