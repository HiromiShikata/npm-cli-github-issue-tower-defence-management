const ALLOWED_IMAGE_URL = new RegExp(
  '^https://github\\.com/user-attachments/' +
    '|^https://[a-z0-9][a-z0-9.-]*\\.githubusercontent\\.com/',
);

export const isAllowedImageUrl = (url: string): boolean =>
  ALLOWED_IMAGE_URL.test(url);

export type ProxiedImageSuccess = {
  ok: true;
  contentType: string;
  body: Buffer;
};

export type ProxiedImageFailure = {
  ok: false;
  statusCode: number;
  error: string;
};

export type ProxiedImageResult = ProxiedImageSuccess | ProxiedImageFailure;

export type ImageFetcher = (
  url: string,
  headers: Record<string, string>,
) => Promise<{
  status: number;
  contentType: string | null;
  body: Buffer;
}>;

const defaultImageFetcher: ImageFetcher = async (url, headers) => {
  const response = await fetch(url, { headers, redirect: 'follow' });
  const arrayBuffer = await response.arrayBuffer();
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    body: Buffer.from(arrayBuffer),
  };
};

export const fetchProxiedImage = async (
  url: string,
  githubToken: string,
  fetcher: ImageFetcher = defaultImageFetcher,
): Promise<ProxiedImageResult> => {
  if (url.length === 0) {
    return { ok: false, statusCode: 400, error: 'missing url parameter' };
  }
  if (!isAllowedImageUrl(url)) {
    return { ok: false, statusCode: 400, error: 'url not in allowed domain' };
  }
  let result: {
    status: number;
    contentType: string | null;
    body: Buffer;
  };
  try {
    result = await fetcher(url, {
      Authorization: `token ${githubToken}`,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, statusCode: 502, error: `proxy error: ${detail}` };
  }
  if (result.status < 200 || result.status >= 300) {
    return {
      ok: false,
      statusCode: 502,
      error: `upstream ${result.status}`,
    };
  }
  return {
    ok: true,
    contentType: result.contentType ?? 'application/octet-stream',
    body: result.body,
  };
};
