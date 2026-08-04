const RAW_CONTENT_HOST = 'raw.githubusercontent.com';

export const normalizeGitHubRawUrl = (rawUrl: string): string | null => {
  if (rawUrl.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') {
    return null;
  }
  if (parsed.hostname === RAW_CONTENT_HOST) {
    return parsed.toString();
  }
  if (parsed.hostname !== 'github.com') {
    return null;
  }
  const segments = parsed.pathname.split('/').filter((part) => part.length > 0);
  if (segments.length < 4 || segments[2] !== 'raw') {
    return null;
  }
  const owner = segments[0];
  const repository = segments[1];
  const rest = segments.slice(3).join('/');
  return `https://${RAW_CONTENT_HOST}/${owner}/${repository}/${rest}`;
};
