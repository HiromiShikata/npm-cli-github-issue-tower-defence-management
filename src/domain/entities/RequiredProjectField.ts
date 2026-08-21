import { FieldOption } from './Project';

export type RequiredProjectFieldDataType = 'DATE' | 'TEXT' | 'SINGLE_SELECT';

export type RequiredProjectFieldDefinition = {
  name: string;
  dataType: RequiredProjectFieldDataType;
  options: Omit<FieldOption, 'id'>[];
};

const storyOption = (
  name: string,
  color: FieldOption['color'],
): Omit<FieldOption, 'id'> => ({ name, color, description: '' });

const REQUIRED_STORY_OPTIONS: Omit<FieldOption, 'id'>[] = [
  storyOption('regular / NO STORY', 'RED'),
  storyOption('regular / WORKFLOW BLOCKER', 'RED'),
  storyOption('regular / inquiry', 'RED'),
  storyOption('regular / high priority', 'RED'),
  storyOption('regular / workflow management', 'YELLOW'),
  storyOption('regular / routine management', 'YELLOW'),
  storyOption('regular / middle bug', 'GRAY'),
  storyOption('regular / minor bug', 'GRAY'),
  storyOption('regular / refactor', 'GRAY'),
  storyOption('regular / backlog', 'GRAY'),
];

const REQUIRED_NEXT_ACTION_HOUR_OPTIONS: Omit<FieldOption, 'id'>[] = Array.from(
  { length: 23 },
  (_, index) => ({
    name: `${index + 1}`,
    color: 'GRAY' as const,
    description: '',
  }),
);

export const STORY_FIELD_NAME = 'Story';
export const NEXT_ACTION_DATE_FIELD_NAME = 'Next Action Date';
export const NEXT_ACTION_HOUR_FIELD_NAME = 'Next Action Hour';
export const DEPENDED_ISSUE_URL_FIELD_NAME =
  'Depended Issue URL separated by comma';
export const AGENT_FIELD_NAME = 'Agent';

export const REQUIRED_PROJECT_FIELDS: RequiredProjectFieldDefinition[] = [
  {
    name: STORY_FIELD_NAME,
    dataType: 'SINGLE_SELECT',
    options: REQUIRED_STORY_OPTIONS,
  },
  {
    name: NEXT_ACTION_DATE_FIELD_NAME,
    dataType: 'DATE',
    options: [],
  },
  {
    name: NEXT_ACTION_HOUR_FIELD_NAME,
    dataType: 'SINGLE_SELECT',
    options: REQUIRED_NEXT_ACTION_HOUR_OPTIONS,
  },
  {
    name: DEPENDED_ISSUE_URL_FIELD_NAME,
    dataType: 'TEXT',
    options: [],
  },
  {
    name: AGENT_FIELD_NAME,
    dataType: 'SINGLE_SELECT',
    options: [],
  },
];
