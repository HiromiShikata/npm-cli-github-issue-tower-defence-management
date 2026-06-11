import type {
  PrListResponse,
  PrDetailResponse,
  ReviewAction,
  DiffLineComment,
  RefResolution,
} from './types';

const getProjectCode = (): string => {
  const match = window.location.pathname.match(/\/projects\/([^/]+)\/prs/);
  return match ? match[1] : '';
};

const buildHeaders = (accessKey: string): HeadersInit => ({
  'X-Access-Key': accessKey,
  'Content-Type': 'application/json',
});

export const fetchPrList = async (
  accessKey: string,
): Promise<PrListResponse> => {
  const projectCode = getProjectCode();
  const response = await fetch(`/projects/${projectCode}/prs/data/list`, {
    headers: buildHeaders(accessKey),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<PrListResponse>;
};

export const fetchPrDetail = async (
  accessKey: string,
  repo: string,
  prNumber: number,
): Promise<PrDetailResponse> => {
  const projectCode = getProjectCode();
  const response = await fetch(
    `/projects/${projectCode}/prs/data/${repo}/${prNumber}`,
    { headers: buildHeaders(accessKey) },
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<PrDetailResponse>;
};

export const submitReview = async (
  accessKey: string,
  action: ReviewAction,
  repo: string,
  prNumber: number,
  projectItemId: string,
  inlineComments: DiffLineComment[],
): Promise<void> => {
  const projectCode = getProjectCode();
  const response = await fetch(`/projects/${projectCode}/prs/review`, {
    method: 'POST',
    headers: buildHeaders(accessKey),
    body: JSON.stringify({
      action,
      repo,
      prNumber,
      projectItemId,
      inlineComments,
    }),
  });
  if (!response.ok) {
    const body = (await response.json()) as { ok: boolean; error: string };
    throw new Error(body.error);
  }
};

export const resolveRef = async (
  owner: string,
  repo: string,
  number: number,
): Promise<RefResolution> => {
  const response = await fetch(
    `/api/resolve-ref?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&number=${number}`,
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<RefResolution>;
};

export const buildImageProxyUrl = (originalUrl: string): string =>
  `/image-proxy?url=${encodeURIComponent(originalUrl)}`;

export const buildBlobUrl = (
  projectCode: string,
  owner: string,
  repo: string,
  ref: string,
  filePath: string,
): string =>
  `/projects/${projectCode}/blob/${owner}/${repo}/${ref}/${filePath}`;
