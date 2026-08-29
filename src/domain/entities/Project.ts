export const FIELD_OPTION_COLORS = [
  'GRAY',
  'BLUE',
  'GREEN',
  'YELLOW',
  'ORANGE',
  'RED',
  'PINK',
  'PURPLE',
] as const;
export type StoryOption = FieldOption;
export type FieldOption = {
  id: string;
  name: string;
  color: (typeof FIELD_OPTION_COLORS)[number];
  description: string;
};

export type StoryListEntry = Omit<FieldOption, 'id'> & {
  id: FieldOption['id'] | null;
};

export const buildStoryListWithNew = (
  existingStories: StoryListEntry[],
  newName: string,
): StoryListEntry[] => {
  if (existingStories.some((s) => s.name === newName)) {
    return [...existingStories];
  }
  const newEntry: StoryListEntry = {
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
export type Project = {
  id: string;
  url: string;
  databaseId: number;
  name: string;
  // fields: ProjectField[];
  status: {
    name: string;
    fieldId: string;
    statuses: FieldOption[];
  };
  nextActionDate: {
    name: string;
    fieldId: string;
  } | null;
  nextActionHour: {
    name: string;
    fieldId: string;
    options: FieldOption[];
  } | null;
  story: {
    name: string;
    fieldId: string;
    databaseId: number;
    stories: FieldOption[];
    workflowManagementStory: {
      id: string;
      name: string;
    };
  } | null;
  remainingEstimationMinutes: {
    name: string;
    fieldId: string;
  } | null;
  dependedIssueUrlSeparatedByComma: {
    name: string;
    fieldId: string;
  } | null;
  completionDate50PercentConfidence: {
    name: string;
    fieldId: string;
  } | null;
  agent: {
    name: string;
    fieldId: string;
    options: FieldOption[];
  } | null;
};
