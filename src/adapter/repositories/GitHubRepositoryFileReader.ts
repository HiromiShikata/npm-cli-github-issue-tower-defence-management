const GITHUB_API_ORIGIN = 'https://api.github.com';

const encodePathSegments = (filePath: string): string =>
  filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

export class GitHubRepositoryFileReader {
  constructor(
    private readonly fetchImplementation: typeof fetch,
    private readonly resolveToken: (owner: string) => string,
  ) {}

  async readFile(
    owner: string,
    repo: string,
    ref: string,
    filePath: string,
  ): Promise<string> {
    const url = `${GITHUB_API_ORIGIN}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePathSegments(filePath)}?ref=${encodeURIComponent(ref)}`;
    const token = this.resolveToken(owner);
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.raw',
    };
    if (token !== '') {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await this.fetchImplementation(url, {
      method: 'GET',
      headers,
    });
    if (response.status === 404) {
      throw new Error(`file_not_found: ${owner}/${repo}@${ref}:${filePath}`);
    }
    if (!response.ok) {
      throw new Error(
        `GitHub contents request for ${owner}/${repo}@${ref}:${filePath} failed with status ${response.status}`,
      );
    }
    return response.text();
  }
}
