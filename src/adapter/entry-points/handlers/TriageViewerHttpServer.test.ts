import http from 'http';
import { TriageViewerHttpServer } from './TriageViewerHttpServer';
import { TriageViewerUseCaseInterface } from '../../../domain/usecases/TriageViewerServerStartUseCase';

const TEST_PORT = 39873;
const TEST_HOST = '127.0.0.1';
const TEST_ACCESS_KEY = 'triage-test-secret-key';

const makeRequest = async (
  method: string,
  requestPath: string,
  headers: Record<string, string> = {},
  body?: string,
): Promise<{ status: number; json: unknown; text: string }> => {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: TEST_HOST,
      port: TEST_PORT,
      path: requestPath,
      method,
      headers,
      agent: new http.Agent({ keepAlive: false }),
    };
    const req = http.request(options, (res) => {
      const chunks: Uint8Array[] = [];
      res.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
        resolve({ status: res.statusCode ?? 0, json, text });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
};

const authHeader = { Authorization: `Bearer ${TEST_ACCESS_KEY}` };

describe('TriageViewerHttpServer', () => {
  let server: TriageViewerHttpServer;
  let mockUseCase: jest.Mocked<TriageViewerUseCaseInterface>;

  beforeEach(async () => {
    mockUseCase = {
      getTriageData: jest.fn().mockResolvedValue({
        issues: [
          {
            number: 1,
            title: 'Test issue',
            body: 'Test body',
            url: 'https://github.com/owner/repo/issues/1',
            owner: 'owner',
            repo: 'repo',
            itemId: 'item-1',
          },
        ],
        storyOptions: [{ id: 'story-1', name: 'Story A', color: 'BLUE' }],
        storyFieldId: 'field-1',
        projectId: 'project-1',
      }),
      setStory: jest.fn().mockResolvedValue({ ok: true }),
      closeIssue: jest.fn().mockResolvedValue({ ok: true }),
      fetchImageProxy: jest.fn().mockResolvedValue({
        content: Buffer.from('img'),
        contentType: 'image/png',
      }),
    };

    server = new TriageViewerHttpServer(mockUseCase, TEST_ACCESS_KEY);
    await server.start(TEST_HOST, TEST_PORT);
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('GET /health', () => {
    it('returns 200 without auth', async () => {
      const result = await makeRequest('GET', '/health');
      expect(result.status).toBe(200);
      expect(result.json).toEqual({ ok: true });
    });
  });

  describe('authentication', () => {
    it('returns 403 for missing key', async () => {
      const result = await makeRequest('GET', '/projects/test/triage/data');
      expect(result.status).toBe(403);
    });

    it('returns 403 for wrong key', async () => {
      const result = await makeRequest('GET', '/projects/test/triage/data', {
        Authorization: 'Bearer wrong-key',
      });
      expect(result.status).toBe(403);
    });

    it('returns HTML redirect page when key is in query param', async () => {
      const result = await makeRequest(
        'GET',
        `/projects/test/triage?key=${TEST_ACCESS_KEY}`,
      );
      expect(result.status).toBe(200);
      expect(result.text).toContain('triage-access-key');
      expect(result.text).toContain('no-referrer');
    });
  });

  describe('GET /projects/:projectCode/triage/data', () => {
    it('returns triage data for valid request', async () => {
      const result = await makeRequest(
        'GET',
        '/projects/https%3A%2F%2Fgithub.com%2Forgs%2Fowner%2Fprojects%2F1/triage/data',
        authHeader,
      );
      expect(result.status).toBe(200);
      expect(
        typeof result.json === 'object' &&
          result.json !== null &&
          'issues' in result.json &&
          Array.isArray(result.json['issues'])
          ? result.json['issues'].length
          : -1,
      ).toBe(1);
      expect(
        typeof result.json === 'object' &&
          result.json !== null &&
          'storyOptions' in result.json &&
          Array.isArray(result.json['storyOptions'])
          ? result.json['storyOptions'].length
          : -1,
      ).toBe(1);
    });

    it('returns 500 when use case throws', async () => {
      mockUseCase.getTriageData.mockRejectedValue(new Error('failure'));
      const result = await makeRequest(
        'GET',
        '/projects/test/triage/data',
        authHeader,
      );
      expect(result.status).toBe(500);
    });
  });

  describe('POST /projects/:projectCode/triage/set-story', () => {
    it('returns 200 on success', async () => {
      const result = await makeRequest(
        'POST',
        '/projects/test/triage/set-story',
        { ...authHeader, 'Content-Type': 'application/json' },
        JSON.stringify({
          projectId: 'project-1',
          storyFieldId: 'field-1',
          itemId: 'item-1',
          storyOptionId: 'story-1',
        }),
      );
      expect(result.status).toBe(200);
      expect(result.json).toEqual({ ok: true });
      expect(mockUseCase.setStory).toHaveBeenCalledWith({
        projectId: 'project-1',
        storyFieldId: 'field-1',
        itemId: 'item-1',
        storyOptionId: 'story-1',
      });
    });

    it('returns 400 for missing fields', async () => {
      const result = await makeRequest(
        'POST',
        '/projects/test/triage/set-story',
        { ...authHeader, 'Content-Type': 'application/json' },
        JSON.stringify({ projectId: 'project-1' }),
      );
      expect(result.status).toBe(400);
    });

    it('returns 400 for invalid JSON', async () => {
      const result = await makeRequest(
        'POST',
        '/projects/test/triage/set-story',
        { ...authHeader, 'Content-Type': 'application/json' },
        'not json',
      );
      expect(result.status).toBe(400);
    });

    it('returns 400 when use case returns error', async () => {
      mockUseCase.setStory.mockResolvedValue({
        ok: false,
        error: 'GraphQL error',
      });
      const result = await makeRequest(
        'POST',
        '/projects/test/triage/set-story',
        { ...authHeader, 'Content-Type': 'application/json' },
        JSON.stringify({
          projectId: 'project-1',
          storyFieldId: 'field-1',
          itemId: 'item-1',
          storyOptionId: 'story-1',
        }),
      );
      expect(result.status).toBe(400);
      expect(
        typeof result.json === 'object' &&
          result.json !== null &&
          'error' in result.json
          ? result.json['error']
          : null,
      ).toBe('GraphQL error');
    });
  });

  describe('POST /projects/:projectCode/triage/close-issue', () => {
    it('returns 200 on success with completed reason', async () => {
      const result = await makeRequest(
        'POST',
        '/projects/test/triage/close-issue',
        { ...authHeader, 'Content-Type': 'application/json' },
        JSON.stringify({
          owner: 'owner',
          repo: 'repo',
          issueNumber: 1,
          reason: 'completed',
        }),
      );
      expect(result.status).toBe(200);
      expect(result.json).toEqual({ ok: true });
      expect(mockUseCase.closeIssue).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issueNumber: 1,
        reason: 'completed',
      });
    });

    it('returns 200 on success with not_planned reason', async () => {
      const result = await makeRequest(
        'POST',
        '/projects/test/triage/close-issue',
        { ...authHeader, 'Content-Type': 'application/json' },
        JSON.stringify({
          owner: 'owner',
          repo: 'repo',
          issueNumber: 1,
          reason: 'not_planned',
        }),
      );
      expect(result.status).toBe(200);
    });

    it('returns 200 on success with duplicate reason', async () => {
      const result = await makeRequest(
        'POST',
        '/projects/test/triage/close-issue',
        { ...authHeader, 'Content-Type': 'application/json' },
        JSON.stringify({
          owner: 'owner',
          repo: 'repo',
          issueNumber: 1,
          reason: 'duplicate',
        }),
      );
      expect(result.status).toBe(200);
    });

    it('returns 400 for invalid reason', async () => {
      const result = await makeRequest(
        'POST',
        '/projects/test/triage/close-issue',
        { ...authHeader, 'Content-Type': 'application/json' },
        JSON.stringify({
          owner: 'owner',
          repo: 'repo',
          issueNumber: 1,
          reason: 'invalid',
        }),
      );
      expect(result.status).toBe(400);
    });

    it('returns 400 for missing fields', async () => {
      const result = await makeRequest(
        'POST',
        '/projects/test/triage/close-issue',
        { ...authHeader, 'Content-Type': 'application/json' },
        JSON.stringify({ owner: 'owner' }),
      );
      expect(result.status).toBe(400);
    });

    it('returns 400 when use case returns error', async () => {
      mockUseCase.closeIssue.mockResolvedValue({
        ok: false,
        error: 'REST error',
      });
      const result = await makeRequest(
        'POST',
        '/projects/test/triage/close-issue',
        { ...authHeader, 'Content-Type': 'application/json' },
        JSON.stringify({
          owner: 'owner',
          repo: 'repo',
          issueNumber: 1,
          reason: 'completed',
        }),
      );
      expect(result.status).toBe(400);
      expect(
        typeof result.json === 'object' &&
          result.json !== null &&
          'error' in result.json
          ? result.json['error']
          : null,
      ).toBe('REST error');
    });
  });

  describe('GET /projects/:projectCode/triage', () => {
    it('returns HTML page', async () => {
      const result = await makeRequest(
        'GET',
        '/projects/test/triage',
        authHeader,
      );
      expect(result.status).toBe(200);
      expect(result.text).toContain('<!DOCTYPE html>');
      expect(result.text).toContain('Triage');
      expect(result.text).toContain('no-referrer');
    });
  });

  describe('GET /image-proxy', () => {
    it('returns image for allowed hostname', async () => {
      const encoded = encodeURIComponent(
        'https://user-images.githubusercontent.com/test.png',
      );
      const result = await makeRequest(
        'GET',
        `/image-proxy?url=${encoded}`,
        authHeader,
      );
      expect(result.status).toBe(200);
    });

    it('returns 400 for missing url param', async () => {
      const result = await makeRequest('GET', '/image-proxy', authHeader);
      expect(result.status).toBe(400);
    });

    it('returns 400 for disallowed hostname', async () => {
      mockUseCase.fetchImageProxy.mockRejectedValue(
        new Error('Hostname not allowed'),
      );
      const encoded = encodeURIComponent('https://evil.com/test.png');
      const result = await makeRequest(
        'GET',
        `/image-proxy?url=${encoded}`,
        authHeader,
      );
      expect(result.status).toBe(400);
    });
  });

  describe('path traversal prevention', () => {
    it('returns 400 for path with ..', async () => {
      const result = await makeRequest('GET', '/../../etc/passwd', authHeader);
      expect(result.status).toBe(400);
    });
  });

  describe('unknown route', () => {
    it('returns 404 for unknown path', async () => {
      const result = await makeRequest('GET', '/unknown-path', authHeader);
      expect(result.status).toBe(404);
    });
  });
});
