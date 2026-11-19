export const CONSOLE_STORY_ROW_FIELDS = [
  'story',
  'status',
  'dependedIssueUrl',
  'nextActionDate',
  'nextActionHour',
  'agent',
] as const;

export type ConsoleStoryRowField = (typeof CONSOLE_STORY_ROW_FIELDS)[number];

export const DEFAULT_SHOWN_CONSOLE_STORY_ROW_FIELDS: ConsoleStoryRowField[] = [
  'story',
  'status',
];

const CONSOLE_STORY_SHOWN_ROW_FIELD_PARAM = 'shownStoryField';
const CONSOLE_STORY_HIDDEN_ROW_FIELD_PARAM = 'hiddenStoryField';

const isSameFieldSet = (
  left: ConsoleStoryRowField[],
  right: ConsoleStoryRowField[],
): boolean =>
  left.length === right.length &&
  left.every((field) => right.includes(field));

export const parseShownConsoleStoryRowFieldsFromSearch = (
  search: string,
): ConsoleStoryRowField[] => {
  const params = new URLSearchParams(search);
  if (!params.has(CONSOLE_STORY_SHOWN_ROW_FIELD_PARAM)) {
    return [...DEFAULT_SHOWN_CONSOLE_STORY_ROW_FIELDS];
  }
  const names = params.getAll(CONSOLE_STORY_SHOWN_ROW_FIELD_PARAM);
  return CONSOLE_STORY_ROW_FIELDS.filter((field) => names.includes(field));
};

export const formatShownConsoleStoryRowFieldsIntoSearch = (
  search: string,
  shownFields: ConsoleStoryRowField[],
): string => {
  const params = new URLSearchParams(search);
  params.delete(CONSOLE_STORY_SHOWN_ROW_FIELD_PARAM);
  params.delete(CONSOLE_STORY_HIDDEN_ROW_FIELD_PARAM);
  if (!isSameFieldSet(shownFields, DEFAULT_SHOWN_CONSOLE_STORY_ROW_FIELDS)) {
    if (shownFields.length === 0) {
      params.append(CONSOLE_STORY_SHOWN_ROW_FIELD_PARAM, '');
    }
    for (const field of CONSOLE_STORY_ROW_FIELDS) {
      if (shownFields.includes(field)) {
        params.append(CONSOLE_STORY_SHOWN_ROW_FIELD_PARAM, field);
      }
    }
  }
  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
};

export const hiddenConsoleStoryRowFields = (
  shownFields: ConsoleStoryRowField[],
): ConsoleStoryRowField[] =>
  CONSOLE_STORY_ROW_FIELDS.filter((field) => !shownFields.includes(field));

export const toggleConsoleStoryRowField = (
  hiddenFields: ConsoleStoryRowField[],
  field: ConsoleStoryRowField,
): ConsoleStoryRowField[] =>
  hiddenFields.includes(field)
    ? hiddenFields.filter((hidden) => hidden !== field)
    : [...hiddenFields, field];
