import { checkIssueSilentDispatchAllowed } from './checkIssueSilentDispatchAllowed';

const VALID_URL = 'https://github.com/owner/repo/issues/42';
const EXPECTED_API_URL = 'https://api.github.com/repos/owner/repo/issues/42';

describe('checkIssueSilentDispatchAllowed', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('exits 0 when the fetched issue body contains the silent-dispatch marker', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          body: 'Some instructions.\n\n<!-- TDPM_SILENT_DISPATCH_ALLOWED -->',
        }),
        { status: 200 },
      ),
    );

    const output = await checkIssueSilentDispatchAllowed({
      issueUrl: VALID_URL,
      ghToken: 'test-token',
    });

    expect(fetchSpy).toHaveBeenCalledWith(EXPECTED_API_URL, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/vnd.github+json',
      },
    });
    expect(output).toEqual({ stdout: null, stderr: null, exitCode: 0 });
  });

  it('exits 1 when the fetched issue body does not contain the silent-dispatch marker', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ body: 'A normal issue body.' }), {
        status: 200,
      }),
    );

    const output = await checkIssueSilentDispatchAllowed({
      issueUrl: VALID_URL,
      ghToken: 'test-token',
    });

    expect(output).toEqual({ stdout: null, stderr: null, exitCode: 1 });
  });

  it('exits 2 without calling fetch when the URL cannot be parsed', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ body: '' }), { status: 200 }),
      );

    const output = await checkIssueSilentDispatchAllowed({
      issueUrl: 'https://example.com/not-an-issue',
      ghToken: 'test-token',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(output.exitCode).toBe(2);
    expect(output.stdout).toBeNull();
    expect(output.stderr).not.toBeNull();
  });

  it('exits 2 when the GitHub API responds with a non-ok status', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response('Not Found', { status: 404, statusText: 'Not Found' }),
      );

    const output = await checkIssueSilentDispatchAllowed({
      issueUrl: VALID_URL,
      ghToken: 'test-token',
    });

    expect(output.exitCode).toBe(2);
    expect(output.stdout).toBeNull();
    expect(output.stderr).not.toBeNull();
  });

  it('exits 2 when the GitHub API response body is not valid JSON', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('not valid json{{{', { status: 200 }));

    const output = await checkIssueSilentDispatchAllowed({
      issueUrl: VALID_URL,
      ghToken: 'test-token',
    });

    expect(output.exitCode).toBe(2);
    expect(output.stdout).toBeNull();
    expect(output.stderr).not.toBeNull();
  });

  it('exits 2 when fetch throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));

    const output = await checkIssueSilentDispatchAllowed({
      issueUrl: VALID_URL,
      ghToken: 'test-token',
    });

    expect(output.exitCode).toBe(2);
    expect(output.stdout).toBeNull();
    expect(output.stderr).not.toBeNull();
  });
});
