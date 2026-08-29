import { FieldOption, Project } from '../../domain/entities/Project';
import {
  AGENT_FIELD_NAME,
  DEPENDED_ISSUE_URL_FIELD_NAME,
  NEXT_ACTION_DATE_FIELD_NAME,
  NEXT_ACTION_HOUR_FIELD_NAME,
  STORY_FIELD_NAME,
} from '../../domain/entities/RequiredProjectField';
import { normalizeFieldName } from './utils';

export type ProjectFieldDefinition = {
  fieldId: string;
  databaseId: number;
  name: string;
  options: FieldOption[];
};

export type ProjectDefinition = {
  id: string;
  url: string;
  databaseId: number;
  name: string;
  fields: ProjectFieldDefinition[];
};

export const convertToFieldOptionColor = (
  color: string,
): FieldOption['color'] => {
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

export const projectFromDefinition = (
  definition: ProjectDefinition,
): Project => {
  const nextActionDate = definition.fields.find(
    (field) =>
      normalizeFieldName(field.name) ===
      normalizeFieldName(NEXT_ACTION_DATE_FIELD_NAME),
  );
  const nextActionHour = definition.fields.find(
    (field) =>
      normalizeFieldName(field.name) ===
      normalizeFieldName(NEXT_ACTION_HOUR_FIELD_NAME),
  );
  const status = definition.fields.find(
    (field) => normalizeFieldName(field.name) === 'status',
  );
  if (!status) {
    throw new Error('status field is not found');
  }
  const story = definition.fields.find(
    (field) =>
      normalizeFieldName(field.name) === normalizeFieldName(STORY_FIELD_NAME),
  );
  const workflowManagementStory = story?.options.find((option) =>
    normalizeFieldName(option.name).includes('workflowmanagement'),
  );
  const remainingEstimationMinutes = definition.fields.find(
    (field) => normalizeFieldName(field.name) === 'remainingestimationminutes',
  );
  const dependedIssueUrlSeparatedByComma = definition.fields.find((field) =>
    normalizeFieldName(field.name).startsWith(
      normalizeFieldName(DEPENDED_ISSUE_URL_FIELD_NAME),
    ),
  );
  const completionDate50PercentConfidence = definition.fields.find((field) =>
    normalizeFieldName(field.name).startsWith('completiondate'),
  );
  const agentField = definition.fields.find(
    (field) =>
      normalizeFieldName(field.name) === normalizeFieldName(AGENT_FIELD_NAME),
  );
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
          options: nextActionHour.options,
        }
      : null,
    story:
      story && workflowManagementStory
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
