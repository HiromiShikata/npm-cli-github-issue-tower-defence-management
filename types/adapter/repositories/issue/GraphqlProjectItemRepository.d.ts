import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
export type ProjectItem = {
  id: string;
  nameWithOwner: string;
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  url: string;
  body: string;
  customFields: {
    name: string;
    value: string | null;
  }[];
};
export declare class GraphqlProjectItemRepository extends BaseGitHubRepository {
  fetchItemId: (
    projectId: string,
    owner: string,
    repositoryName: string,
    issueNumber: number,
  ) => Promise<string | undefined>;
  fetchProjectItems: (projectId: string) => Promise<ProjectItem[]>;
  getProjectItemFieldsFromIssueUrl: (issueUrl: string) => Promise<
    {
      fieldName: string;
      fieldValue: string;
    }[]
  >;
  getProjectItemFields: (
    owner: string,
    repositoryName: string,
    issueNumber: number,
  ) => Promise<
    {
      fieldName: string;
      fieldValue: string;
    }[]
  >;
  fetchProjectItemByUrl: (issueUrl: string) => Promise<ProjectItem | null>;
  convertStrToState: (state: string) => 'OPEN' | 'CLOSED' | 'MERGED';
  updateProjectField: (
    projectId: string,
    fieldId: string,
    itemId: string,
    value:
      | {
          text: string;
        }
      | {
          number: number;
        }
      | {
          date: string;
        }
      | {
          singleSelectOptionId: string;
        },
  ) => Promise<void>;
  clearProjectField: (
    projectId: string,
    fieldId: string,
    itemId: string,
  ) => Promise<void>;
  updateProjectTextField: (
    project: Project['id'],
    fieldId: string,
    issue: Issue['itemId'],
    text: string,
  ) => Promise<void>;
  removeItemFromProject: (projectId: string, itemId: string) => Promise<void>;
  removeItemFromProjectByIssueUrl: (
    issueUrl: string,
    projectId: string,
  ) => Promise<void>;
}
//# sourceMappingURL=GraphqlProjectItemRepository.d.ts.map
