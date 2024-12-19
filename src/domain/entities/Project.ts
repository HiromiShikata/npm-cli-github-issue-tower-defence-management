export type StoryOption = {
  id: string;
  name: string;
  color: string;
  description: string;
};
export type Project = {
  id: string;
  name: string;
  // fields: ProjectField[];
  nextActionDate: {
    name: string;
    fieldId: string;
  } | null;
  nextActionHour: {
    name: string;
    fieldId: string;
  } | null;
  story: {
    name: string;
    fieldId: string;
    stories: StoryOption[];
    workflowManagementStory: {
      id: string;
      name: string;
    };
  } | null;
  remainingEstimationMinutes: {
    name: string;
    fieldId: string;
  } | null;
};
