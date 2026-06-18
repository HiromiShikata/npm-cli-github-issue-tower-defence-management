import type {
  ConsoleComment,
  ConsoleItemBody,
  ConsoleOperationEvent,
  ConsolePullRequestCommit,
  ConsolePullRequestDetail,
  ConsolePullRequestFile,
  ConsoleRelatedPullRequest,
  ConsoleReviewTarget,
} from '../types';

export type ConsoleApiClient = {
  fetchItemBody: (repo: string, number: number) => Promise<ConsoleItemBody>;
  fetchComments: (repo: string, number: number) => Promise<ConsoleComment[]>;
  fetchPullRequestFiles: (
    repo: string,
    number: number,
  ) => Promise<ConsolePullRequestFile[]>;
  fetchPullRequestCommits: (
    repo: string,
    number: number,
  ) => Promise<ConsolePullRequestCommit[]>;
  fetchRelatedPullRequests: (
    repo: string,
    number: number,
  ) => Promise<ConsoleRelatedPullRequest[]>;
  fetchPullRequestDetail: (
    repo: string,
    number: number,
  ) => Promise<ConsolePullRequestDetail | null>;
  postReview: (
    target: ConsoleReviewTarget,
    event: ConsoleOperationEvent,
  ) => Promise<void>;
  postTriage: (
    projectItemId: string,
    repo: string,
    number: number,
    event: ConsoleOperationEvent,
    optionId: string | null,
  ) => Promise<void>;
  postInTmux: (
    projectItemId: string,
    url: string,
    title: string,
    story: string,
  ) => Promise<void>;
};

type ApiClientDependencies = {
  pjcode: string;
  appendToken: (url: string) => string;
  fetchImpl?: typeof fetch;
};

const buildItemQuery = (pjcode: string, repo: string, number: number): string =>
  `pjcode=${encodeURIComponent(pjcode)}&repo=${encodeURIComponent(
    repo,
  )}&number=${encodeURIComponent(String(number))}`;

const readJson = async (
  fetchImpl: typeof fetch,
  url: string,
): Promise<Record<string, unknown>> => {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as Record<string, unknown>;
};

const postJson = async (
  fetchImpl: typeof fetch,
  url: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
};

export const createConsoleApiClient = ({
  pjcode,
  appendToken,
  fetchImpl = fetch,
}: ApiClientDependencies): ConsoleApiClient => {
  const itemUrl = (path: string, repo: string, number: number): string =>
    appendToken(`/api/${path}?${buildItemQuery(pjcode, repo, number)}`);

  const fetchComments = async (
    repo: string,
    number: number,
  ): Promise<ConsoleComment[]> => {
    const data = await readJson(fetchImpl, itemUrl('comments', repo, number));
    return Array.isArray(data.comments)
      ? (data.comments as ConsoleComment[])
      : [];
  };

  const fetchPullRequestFiles = async (
    repo: string,
    number: number,
  ): Promise<ConsolePullRequestFile[]> => {
    const data = await readJson(fetchImpl, itemUrl('prfiles', repo, number));
    return Array.isArray(data.files)
      ? (data.files as ConsolePullRequestFile[])
      : [];
  };

  const fetchPullRequestCommits = async (
    repo: string,
    number: number,
  ): Promise<ConsolePullRequestCommit[]> => {
    const data = await readJson(fetchImpl, itemUrl('prcommits', repo, number));
    return Array.isArray(data.commits)
      ? (data.commits as ConsolePullRequestCommit[])
      : [];
  };

  const fetchPullRequestDetail = async (
    repo: string,
    number: number,
  ): Promise<ConsolePullRequestDetail | null> => {
    const data = await readJson(fetchImpl, itemUrl('prdetail', repo, number));
    if (data.detail === null || data.detail === undefined) {
      return null;
    }
    return data.detail as ConsolePullRequestDetail;
  };

  return {
    fetchItemBody: async (repo, number) => {
      const data = await readJson(fetchImpl, itemUrl('itembody', repo, number));
      return {
        body: typeof data.body === 'string' ? data.body : '',
        labels: Array.isArray(data.labels) ? (data.labels as string[]) : [],
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
        comments: Array.isArray(data.comments)
          ? (data.comments as ConsoleComment[])
          : [],
        state: data.state === 'closed' ? 'closed' : 'open',
        stateReason:
          data.stateReason === 'completed' || data.stateReason === 'not_planned'
            ? data.stateReason
            : '',
      };
    },
    fetchComments,
    fetchPullRequestFiles,
    fetchPullRequestCommits,
    fetchRelatedPullRequests: async (repo, number) => {
      const data = await readJson(
        fetchImpl,
        itemUrl('relatedprs', repo, number),
      );
      return Array.isArray(data.prs)
        ? (data.prs as ConsoleRelatedPullRequest[])
        : [];
    },
    fetchPullRequestDetail,
    postReview: async (target, event) => {
      await postJson(fetchImpl, appendToken('/api/review'), {
        pjcode,
        repo: target.repo,
        pr: target.number,
        event,
      });
    },
    postTriage: async (projectItemId, repo, number, event, optionId) => {
      await postJson(fetchImpl, appendToken('/api/triage'), {
        pjcode,
        projectItemId,
        repo,
        issue: number,
        action: event,
        optionId,
      });
    },
    postInTmux: async (projectItemId, url, title, story) => {
      await postJson(fetchImpl, appendToken('/api/intmux'), {
        pjcode,
        projectItemId,
        url,
        title,
        story,
      });
    },
  };
};
