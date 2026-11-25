export type CreateTaskDefaults = {
  nameWithOwner: string | null;
  storyName: string | null;
};

const nonEmptyStringOrNull = (value: string | null): string | null =>
  value === null || value === '' ? null : value;

export const resolveCreateTaskDefaults = (input: {
  defaultNameWithOwner: string | null;
  storyOptionNames: string[];
}): CreateTaskDefaults => ({
  nameWithOwner: nonEmptyStringOrNull(input.defaultNameWithOwner),
  storyName: nonEmptyStringOrNull(input.storyOptionNames[0] ?? null),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

export const NO_CREATE_TASK_DEFAULTS: CreateTaskDefaults = {
  nameWithOwner: null,
  storyName: null,
};

export const createTaskDefaultsFromStoriesListJson = (
  listJson: unknown,
): CreateTaskDefaults => {
  if (!isRecord(listJson) || !Array.isArray(listJson.stories)) {
    return NO_CREATE_TASK_DEFAULTS;
  }
  const firstStory: unknown = listJson.stories[0];
  const firstStoryName = isRecord(firstStory)
    ? stringOrNull(firstStory.storyName)
    : null;
  return resolveCreateTaskDefaults({
    defaultNameWithOwner: stringOrNull(listJson.defaultNameWithOwner),
    storyOptionNames: firstStoryName === null ? [] : [firstStoryName],
  });
};
