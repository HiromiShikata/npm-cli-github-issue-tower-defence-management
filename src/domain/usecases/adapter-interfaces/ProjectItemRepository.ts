export type ProjectItemCustomField = {
  name: string;
  value: string | null;
};

export type ProjectItemSnapshot = {
  id: string;
  url: string;
  customFields: ProjectItemCustomField[];
};

export interface ProjectItemRepository {
  fetchProjectItems: (projectId: string) => Promise<ProjectItemSnapshot[]>;
  removeItemFromProjectByIssueUrl: (
    issueUrl: string,
    projectId: string,
  ) => Promise<void>;
}
