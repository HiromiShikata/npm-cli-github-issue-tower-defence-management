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
    stories: {
      id: string;
      name: string;
    }[];
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
