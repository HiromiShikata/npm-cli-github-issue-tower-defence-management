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
    body: string | null;
    labels: string[];
    assignees: string[];
    createdAt: string;
    updatedAt: string;
    author: string;
    closingIssueReferenceUrls: string[];
    customFields: {
        name: string;
        value: string | null;
    }[];
};
export type ProjectItemLight = {
    id: string;
    updatedAt: string;
    url: string;
    number: number;
};
export declare const PAGINATION_DELAY_MS = 5000;
export declare const FETCH_PROJECT_ITEMS_INITIAL_PAGE_SIZE = 100;
export declare const FETCH_PROJECT_ITEMS_BY_IDS_BATCH_SIZE = 100;
export declare const FETCH_PROJECT_ITEMS_GRAPHQL_ERROR_PAYLOAD_MAX_LENGTH = 4000;
export declare const RATE_LIMIT_MAX_RETRIES = 6;
export declare const RATE_LIMIT_MIN_BACKOFF_MS = 1000;
export declare const RATE_LIMIT_DEFAULT_BACKOFF_MS = 60000;
export declare const RATE_LIMIT_MAX_BACKOFF_MS = 300000;
export declare const callWithRateLimitRetry: <T>(request: () => Promise<T>) => Promise<T>;
export declare class GraphqlProjectItemRepository extends BaseGitHubRepository {
    fetchItemId: (projectId: string, owner: string, repositoryName: string, issueNumber: number) => Promise<string | undefined>;
    fetchProjectItems: (projectId: string, query?: string) => Promise<ProjectItem[]>;
    private mapProjectV2ItemNodeToProjectItem;
    fetchProjectItemsLight: (projectId: string, query?: string) => Promise<ProjectItemLight[]>;
    fetchProjectItemsByIds: (ids: string[]) => Promise<ProjectItem[]>;
    getProjectItemFieldsFromIssueUrl: (issueUrl: string) => Promise<{
        fieldName: string;
        fieldValue: string;
    }[]>;
    getProjectItemFields: (owner: string, repositoryName: string, issueNumber: number) => Promise<{
        fieldName: string;
        fieldValue: string;
    }[]>;
    fetchProjectItemByUrl: (issueUrl: string, projectId?: string) => Promise<ProjectItem | null>;
    convertStrToState: (state: string) => "OPEN" | "CLOSED" | "MERGED";
    updateProjectField: (projectId: string, fieldId: string, itemId: string, value: {
        text: string;
    } | {
        number: number;
    } | {
        date: string;
    } | {
        singleSelectOptionId: string;
    }) => Promise<void>;
    clearProjectField: (projectId: string, fieldId: string, itemId: string) => Promise<void>;
    updateProjectTextField: (project: Project["id"], fieldId: string, issue: Issue["itemId"], text: string) => Promise<void>;
    removeItemFromProject: (projectId: string, itemId: string) => Promise<void>;
    removeItemFromProjectByIssueUrl: (issueUrl: string, projectId: string) => Promise<void>;
    addIssueToProject: (projectId: string, issueUrl: string) => Promise<string>;
}
//# sourceMappingURL=GraphqlProjectItemRepository.d.ts.map