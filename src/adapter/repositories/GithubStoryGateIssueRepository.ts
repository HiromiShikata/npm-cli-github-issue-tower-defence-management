import { isRecord } from '../../domain/usecases/isRecord';
import {
  ClosingPullRequest,
  ClosingPullRequestState,
  GithubIssueReference,
  IssueProjectItem,
  IssueProjectItemsSnapshot,
  ProjectItemSingleSelectValueUpdate,
  ProjectSingleSelectField,
  StoryGateGithubRequestError,
  StoryGateIssue,
  StoryGateIssueComment,
  StoryGateIssueRepository,
  StoryGateIssueState,
} from '../../domain/usecases/adapter-interfaces/StoryGateIssueRepository';

export const GITHUB_API_BASE_URL = 'https://api.github.com';
export const GITHUB_GRAPHQL_URL = `${GITHUB_API_BASE_URL}/graphql`;
export const GITHUB_COMMENTS_PAGE_SIZE = 100;
export const RATE_LIMIT_RETRY_LIMIT = 3;
export const RATE_LIMIT_DEFAULT_WAIT_SECONDS = 30;
export const RATE_LIMIT_MAXIMUM_WAIT_SECONDS = 120;
export const TRANSIENT_FAILURE_RETRY_LIMIT = 3;
export const TRANSIENT_FAILURE_RETRY_BASE_WAIT_MILLISECONDS = 1000;

type HttpMethod = 'GET' | 'POST';

type GithubHttpResponse = {
  status: number;
  body: unknown;
};

const fieldOf = (value: unknown, key: string): unknown =>
  isRecord(value) ? value[key] : undefined;

const stringFieldOf = (value: unknown, key: string): string | null => {
  const field = fieldOf(value, key);
  return typeof field === 'string' ? field : null;
};

const arrayFieldOf = (value: unknown, key: string): unknown[] => {
  const field = fieldOf(value, key);
  return Array.isArray(field) ? field : [];
};

const issueStateParse = (state: string | null): StoryGateIssueState =>
  state !== null && state.toUpperCase() === 'OPEN' ? 'OPEN' : 'CLOSED';

const closingPullRequestStateParse = (
  state: string | null,
): ClosingPullRequestState | null => {
  if (state === 'OPEN' || state === 'CLOSED' || state === 'MERGED') {
    return state;
  }
  return null;
};

const retryAfterSecondsParse = (headers: Headers): number => {
  const retryAfter = headers.get('retry-after');
  const parsed =
    retryAfter !== null && /^\d+$/.test(retryAfter.trim())
      ? Number.parseInt(retryAfter.trim(), 10)
      : RATE_LIMIT_DEFAULT_WAIT_SECONDS;
  return Math.min(parsed, RATE_LIMIT_MAXIMUM_WAIT_SECONDS);
};

const transientFailureRetryWaitMillisecondsOf = (attempt: number): number =>
  TRANSIENT_FAILURE_RETRY_BASE_WAIT_MILLISECONDS * 2 ** attempt;

const singleSelectFieldParse = (
  value: unknown,
): ProjectSingleSelectField | null => {
  const fieldId = stringFieldOf(value, 'id');
  if (fieldId === null) {
    return null;
  }
  return {
    fieldId,
    options: arrayFieldOf(value, 'options').flatMap((option) => {
      const id = stringFieldOf(option, 'id');
      const name = stringFieldOf(option, 'name');
      return id !== null && name !== null
        ? [{ id, name, color: stringFieldOf(option, 'color') ?? '' }]
        : [];
    }),
  };
};

const projectItemParse = (node: unknown): IssueProjectItem[] => {
  const itemId = stringFieldOf(node, 'id');
  const project = fieldOf(node, 'project');
  const projectId = stringFieldOf(project, 'id');
  if (itemId === null || projectId === null) {
    return [];
  }
  return [
    {
      projectId,
      itemId,
      storyField:
        singleSelectFieldParse(fieldOf(project, 'upperStoryField')) ??
        singleSelectFieldParse(fieldOf(project, 'lowerStoryField')),
      storyName:
        stringFieldOf(fieldOf(node, 'upperStory'), 'name') ??
        stringFieldOf(fieldOf(node, 'lowerStory'), 'name'),
      agentField: singleSelectFieldParse(fieldOf(project, 'agentField')),
      agentName: stringFieldOf(fieldOf(node, 'agent'), 'name'),
      statusField: singleSelectFieldParse(fieldOf(project, 'statusField')),
      statusName: stringFieldOf(fieldOf(node, 'status'), 'name'),
    },
  ];
};

const graphqlErrorsOf = (body: unknown): { type: string; message: string }[] =>
  arrayFieldOf(body, 'errors').map((error) => ({
    type: stringFieldOf(error, 'type') ?? '',
    message: stringFieldOf(error, 'message') ?? JSON.stringify(error),
  }));

export const ISSUE_PROJECT_ITEMS_QUERY = `query StoryGateIssueProjectItems($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issueOrPullRequest(number: $number) {
      ... on Issue { state projectItems(first: 20) { nodes { ...StoryGateProjectItem } } }
      ... on PullRequest { state projectItems(first: 20) { nodes { ...StoryGateProjectItem } } }
    }
  }
}
fragment StoryGateSingleSelectField on ProjectV2SingleSelectField { id options { id name color } }
fragment StoryGateProjectItem on ProjectV2Item {
  id
  project {
    id
    upperStoryField: field(name: "Story") { ...StoryGateSingleSelectField }
    lowerStoryField: field(name: "story") { ...StoryGateSingleSelectField }
    agentField: field(name: "Agent") { ...StoryGateSingleSelectField }
    statusField: field(name: "Status") { ...StoryGateSingleSelectField }
  }
  upperStory: fieldValueByName(name: "Story") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
  lowerStory: fieldValueByName(name: "story") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
  agent: fieldValueByName(name: "Agent") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
  status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
}`;

export const CLOSING_PULL_REQUESTS_QUERY = `query StoryGateClosingPullRequests($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issueOrPullRequest(number: $number) {
      ... on Issue {
        timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
          nodes { ... on CrossReferencedEvent { willCloseTarget source { ... on PullRequest { url state } } } }
        }
      }
    }
  }
}`;

export const PROJECT_ITEM_SINGLE_SELECT_UPDATE_MUTATION = `mutation StoryGateProjectItemSingleSelectUpdate($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }) {
    projectV2Item { id }
  }
}`;

const defaultWaitForMilliseconds = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class GithubStoryGateIssueRepository implements StoryGateIssueRepository {
  constructor(
    private readonly ghToken: string,
    private readonly waitForMilliseconds: (
      milliseconds: number,
    ) => Promise<void> = defaultWaitForMilliseconds,
  ) {}

  findIssue = async (
    issue: GithubIssueReference,
  ): Promise<StoryGateIssue | null> => {
    const url = `${GITHUB_API_BASE_URL}/repos/${issue.owner}/${issue.repo}/issues/${issue.number}`;
    const response = await this.request('GET', url, null);
    if (response.status === 404) {
      return null;
    }
    this.assertSuccessful('GET', url, response);
    return {
      url: issue.url,
      state: issueStateParse(stringFieldOf(response.body, 'state')),
      body: stringFieldOf(response.body, 'body') ?? '',
      labels: arrayFieldOf(response.body, 'labels').flatMap((label) => {
        const name =
          typeof label === 'string' ? label : stringFieldOf(label, 'name');
        return name === null ? [] : [name];
      }),
    };
  };

  listIssueComments = async (
    issue: GithubIssueReference,
  ): Promise<StoryGateIssueComment[]> => {
    const comments: StoryGateIssueComment[] = [];
    for (let page = 1; ; page++) {
      const url = `${GITHUB_API_BASE_URL}/repos/${issue.owner}/${issue.repo}/issues/${issue.number}/comments?per_page=${GITHUB_COMMENTS_PAGE_SIZE}&page=${page}`;
      const response = await this.request('GET', url, null);
      this.assertSuccessful('GET', url, response);
      const pageComments = Array.isArray(response.body) ? response.body : [];
      pageComments.forEach((comment) =>
        comments.push({
          url: stringFieldOf(comment, 'html_url') ?? '',
          createdAt: stringFieldOf(comment, 'created_at') ?? '',
          body: stringFieldOf(comment, 'body') ?? '',
        }),
      );
      if (pageComments.length < GITHUB_COMMENTS_PAGE_SIZE) {
        return comments;
      }
    }
  };

  findIssueProjectItems = async (
    issue: GithubIssueReference,
  ): Promise<IssueProjectItemsSnapshot | null> => {
    const data = await this.graphql(ISSUE_PROJECT_ITEMS_QUERY, {
      owner: issue.owner,
      repo: issue.repo,
      number: issue.number,
    });
    const issueNode = fieldOf(
      fieldOf(data, 'repository'),
      'issueOrPullRequest',
    );
    if (!isRecord(issueNode)) {
      return null;
    }
    return {
      state: issueStateParse(stringFieldOf(issueNode, 'state')),
      items: arrayFieldOf(fieldOf(issueNode, 'projectItems'), 'nodes').flatMap(
        projectItemParse,
      ),
    };
  };

  listClosingPullRequests = async (
    issue: GithubIssueReference,
  ): Promise<ClosingPullRequest[]> => {
    const data = await this.graphql(CLOSING_PULL_REQUESTS_QUERY, {
      owner: issue.owner,
      repo: issue.repo,
      number: issue.number,
    });
    const nodes = arrayFieldOf(
      fieldOf(
        fieldOf(fieldOf(data, 'repository'), 'issueOrPullRequest'),
        'timelineItems',
      ),
      'nodes',
    );
    const closingPullRequests: ClosingPullRequest[] = [];
    for (const node of nodes) {
      const source = fieldOf(node, 'source');
      const url = stringFieldOf(source, 'url');
      const state = closingPullRequestStateParse(
        stringFieldOf(source, 'state'),
      );
      if (
        fieldOf(node, 'willCloseTarget') === true &&
        url !== null &&
        state !== null &&
        !closingPullRequests.some((pullRequest) => pullRequest.url === url)
      ) {
        closingPullRequests.push({ url, state });
      }
    }
    return closingPullRequests;
  };

  updateProjectItemSingleSelectValue = async (
    update: ProjectItemSingleSelectValueUpdate,
  ): Promise<void> => {
    await this.graphql(PROJECT_ITEM_SINGLE_SELECT_UPDATE_MUTATION, {
      projectId: update.projectId,
      itemId: update.itemId,
      fieldId: update.fieldId,
      optionId: update.optionId,
    });
  };

  private graphql = async (
    query: string,
    variables: Record<string, string | number>,
  ): Promise<unknown> => {
    const response = await this.request('POST', GITHUB_GRAPHQL_URL, {
      query,
      variables,
    });
    this.assertSuccessful('POST', GITHUB_GRAPHQL_URL, response);
    const errors = graphqlErrorsOf(response.body);
    const operationName =
      query.match(/^(?:query|mutation)\s+(\w+)/)?.[1] ?? 'anonymous';
    if (errors.some((error) => error.type !== 'NOT_FOUND')) {
      throw new StoryGateGithubRequestError(
        `POST ${GITHUB_GRAPHQL_URL} ${operationName} ${JSON.stringify(variables)} returned errors: ${errors
          .map((error) => `${error.type} ${error.message}`)
          .join('; ')}`,
      );
    }
    return fieldOf(response.body, 'data') ?? null;
  };

  private assertSuccessful = (
    method: HttpMethod,
    url: string,
    response: GithubHttpResponse,
  ): void => {
    if (response.status < 200 || response.status >= 300) {
      throw new StoryGateGithubRequestError(
        `${method} ${url} returned HTTP ${response.status}`,
        response.status,
      );
    }
  };

  private request = async (
    method: HttpMethod,
    url: string,
    requestBody: Record<string, unknown> | null,
  ): Promise<GithubHttpResponse> => {
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.ghToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: requestBody === null ? undefined : JSON.stringify(requestBody),
        });
      } catch (error) {
        if (attempt < TRANSIENT_FAILURE_RETRY_LIMIT) {
          await this.waitForMilliseconds(
            transientFailureRetryWaitMillisecondsOf(attempt),
          );
          continue;
        }
        throw new StoryGateGithubRequestError(
          `${method} ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (response.status === 429 && attempt < RATE_LIMIT_RETRY_LIMIT) {
        await this.waitForMilliseconds(
          retryAfterSecondsParse(response.headers) * 1000,
        );
        continue;
      }
      if (response.status >= 500 && attempt < TRANSIENT_FAILURE_RETRY_LIMIT) {
        await this.waitForMilliseconds(
          transientFailureRetryWaitMillisecondsOf(attempt),
        );
        continue;
      }
      const text = await response.text();
      try {
        const body: unknown = text === '' ? null : JSON.parse(text);
        return { status: response.status, body };
      } catch {
        if (response.ok) {
          throw new StoryGateGithubRequestError(
            `${method} ${url} returned HTTP ${response.status} with a body that is not JSON`,
            response.status,
          );
        }
        return { status: response.status, body: null };
      }
    }
  };
}
