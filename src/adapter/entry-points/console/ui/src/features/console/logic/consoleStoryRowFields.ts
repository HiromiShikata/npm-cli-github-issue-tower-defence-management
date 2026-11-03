export const CONSOLE_STORY_ROW_FIELDS = [
  'dependedIssueUrl',
  'nextActionDate',
  'nextActionHour',
  'agent',
  'story',
  'status',
] as const;

export type ConsoleStoryRowField = (typeof CONSOLE_STORY_ROW_FIELDS)[number];

const CONSOLE_STORY_HIDDEN_ROW_FIELD_PARAM = 'hiddenStoryField';

export const parseHiddenConsoleStoryRowFieldsFromSearch = (
  search: string,
): ConsoleStoryRowField[] => {
  const names = new URLSearchParams(search).getAll(
    CONSOLE_STORY_HIDDEN_ROW_FIELD_PARAM,
  );
  return CONSOLE_STORY_ROW_FIELDS.filter((field) => names.includes(field));
};

export const formatHiddenConsoleStoryRowFieldsIntoSearch = (
  search: string,
  hiddenFields: ConsoleStoryRowField[],
): string => {
  const params = new URLSearchParams(search);
  params.delete(CONSOLE_STORY_HIDDEN_ROW_FIELD_PARAM);
  for (const field of CONSOLE_STORY_ROW_FIELDS) {
    if (hiddenFields.includes(field)) {
      params.append(CONSOLE_STORY_HIDDEN_ROW_FIELD_PARAM, field);
    }
  }
  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
};

export const toggleConsoleStoryRowField = (
  hiddenFields: ConsoleStoryRowField[],
  field: ConsoleStoryRowField,
): ConsoleStoryRowField[] =>
  hiddenFields.includes(field)
    ? hiddenFields.filter((hidden) => hidden !== field)
    : [...hiddenFields, field];
