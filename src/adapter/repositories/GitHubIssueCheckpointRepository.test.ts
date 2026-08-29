import { GitHubIssueCheckpointRepository } from './GitHubIssueCheckpointRepository';

const VALID_URL = 'https://github.com/owner/repo/issues/42';
const EXPECTED_API_URL =
  'https://api.github.com/repos/owner/repo/issues/42/comments';
const EXPECTED_BODY = JSON.stringify({
  body: 'From: :robot: preparation-daemon (-)\n\n```json\n{"pullRequestRequired": false}\n```\n\nThis implementation session was interrupted by the preparation daemon due to token near exhaustion. The task will be re-dispatched.',
});

describe('GitHubIssueCheckpointRepository', () => {
  let repository: GitHubIssueCheckpointRepository;

  beforeEach(() => {
    jest.restoreAllMocks();
    repository = new GitHubIssueCheckpointRepository('test-token');
  });

  it('posts to the correct GitHub API URL with correct headers and body', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 201 }));

    await repository.postCheckpoint(VALID_URL);

    expect(fetchSpy).toHaveBeenCalledWith(EXPECTED_API_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: EXPECTED_BODY,
    });
  });

  it('throws when the response is not 2xx', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' }),
      );

    await expect(repository.postCheckpoint(VALID_URL)).rejects.toThrow('403');
  });

  it('throws when the URL does not match the expected GitHub issue pattern', async () => {
    await expect(
      repository.postCheckpoint('https://example.com/not-an-issue'),
    ).rejects.toThrow('Invalid GitHub issue URL');
  });
});
