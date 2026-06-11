import http from 'http';
import path from 'path';
import fs from 'fs';
import { PrReviewViewerHttpServer, ImageProxyRepository } from './PrReviewViewerHttpServer';
import { PrReviewViewerUseCaseInterface } from '../../../domain/usecases/PrReviewViewerServerStartUseCase';

jest.mock('../../../domain/usecases/PrReviewViewerServerStartUseCase');

const TEST_PORT = 39871;
const TEST_HOST = '127.0.0.1';
const TEST_ACCESS_KEY = 'test-secret-key';
const TEST_STATIC_DIR = path.join(__dirname, '../../../../tmp/test-static');

const makeRequest = async (
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: string,
): Promise<{ status: number; json: unknown }> => {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: TEST_HOST,
      port: TEST_PORT,
      path,
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
          json = text;
        }
        resolve({ status: res.statusCode ?? 0, json });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
};

describe('PrReviewViewerHttpServer', () => {
  let server: PrReviewViewerHttpServer;
  let mockUseCase: jest.Mocked<PrReviewViewerUseCaseInterface>;
  let mockGitHubRepo: jest.Mocked<ImageProxyRepository>;

  beforeAll(() => {
    if (!fs.existsSync(TEST_STATIC_DIR)) {
      fs.mkdirSync(TEST_STATIC_DIR, { recursive: true });
    }
    fs.writeFileSync(
      path.join(TEST_STATIC_DIR, 'index.html'),
      '<html><body>viewer</body></html>',
    );
  });

  afterAll(() => {
    if (fs.existsSync(TEST_STATIC_DIR)) {
      fs.rmSync(TEST_STATIC_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    mockUseCase = {
      getList: jest.fn().mockResolvedValue([]),
      getDetail: jest.fn().mockResolvedValue(null),
      executeReview: jest.fn().mockResolvedValue({ ok: true }),
      getFileContent: jest.fn().mockResolvedValue({
        content: Buffer.from('img data'),
        contentType: 'image/png',
      }),
      getIssueTitleInfo: jest.fn().mockResolvedValue({
        title: 'Test Issue',
        state: 'open',
        isPR: false,
        url: 'https://github.com/owner/repo/issues/1',
      }),
    };
    mockGitHubRepo = {
      fetchImageProxy: jest.fn().mockResolvedValue({
        content: Buffer.from('proxy data'),
        contentType: 'image/jpeg',
      }),
    };

    server = new PrReviewViewerHttpServer(
      mockUseCase,
      mockGitHubRepo,
      TEST_ACCESS_KEY,
      TEST_STATIC_DIR,
    );
    await server.start(TEST_HOST, TEST_PORT);
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('startup', () => {
    it('starts and responds to health endpoint', async () => {
      const { status, json } = await makeRequest('GET', '/health');
      expect(status).toBe(200);
      expect(json).toEqual({ ok: true });
    });
  });

  describe('access key validation', () => {
    it('rejects GET /projects/:projectCode/prs/data/list without token with 403', async () => {
      const { status, json } = await makeRequest(
        'GET',
        '/projects/myproject/prs/data/list',
      );
      expect(status).toBe(403);
      expect(json).toEqual({ ok: false, error: 'Unauthorized' });
    });

    it('rejects with wrong token with 403', async () => {
      const { status, json } = await makeRequest(
        'GET',
        '/projects/myproject/prs/data/list',
        { Authorization: 'Bearer wrong-key' },
      );
      expect(status).toBe(403);
      expect(json).toEqual({ ok: false, error: 'Unauthorized' });
    });

    it('accepts valid token in Authorization header', async () => {
      const { status } = await makeRequest(
        'GET',
        '/projects/myproject/prs/data/list',
        { Authorization: `Bearer ${TEST_ACCESS_KEY}` },
      );
      expect(status).toBe(200);
    });

    it('accepts valid token as query parameter', async () => {
      const { status } = await makeRequest(
        'GET',
        `/projects/myproject/prs/data/list?key=${TEST_ACCESS_KEY}`,
      );
      expect(status).toBe(200);
    });
  });

  describe('GET /projects/:projectCode/prs/data/list', () => {
    it('returns list from use case', async () => {
      const items = [
        {
          issue: {
            number: 1,
            title: 'Issue',
            author: 'author',
            url: 'https://github.com/owner/repo/issues/1',
            story: null,
            projectItemId: 'PVTI_x',
          },
          pr: {
            number: 42,
            repo: 'owner/repo',
            title: 'PR',
            additions: 1,
            deletions: 0,
            changedFiles: 1,
            url: 'https://github.com/owner/repo/pull/42',
          },
        },
      ];
      mockUseCase.getList.mockResolvedValue(items);
      const { status, json } = await makeRequest(
        'GET',
        '/projects/myproject/prs/data/list',
        { Authorization: `Bearer ${TEST_ACCESS_KEY}` },
      );
      expect(status).toBe(200);
      expect(json).toEqual(items);
    });
  });

  describe('GET /projects/:projectCode/prs/data/:repo/:prNumber', () => {
    it('returns 404 when detail not found', async () => {
      mockUseCase.getDetail.mockResolvedValue(null);
      const { status, json } = await makeRequest(
        'GET',
        '/projects/myproject/prs/data/owner__repo/42',
        { Authorization: `Bearer ${TEST_ACCESS_KEY}` },
      );
      expect(status).toBe(404);
      expect(json).toEqual({ ok: false, error: 'Not found' });
    });

    it('returns detail when found', async () => {
      mockUseCase.getDetail.mockResolvedValue({ body: 'PR body', files: [] });
      const { status, json } = await makeRequest(
        'GET',
        '/projects/myproject/prs/data/owner__repo/42',
        { Authorization: `Bearer ${TEST_ACCESS_KEY}` },
      );
      expect(status).toBe(200);
      expect(json).toEqual({ body: 'PR body', files: [] });
    });
  });

  describe('POST /projects/:projectCode/prs/review', () => {
    it('returns 400 for missing required fields', async () => {
      const { status, json } = await makeRequest(
        'POST',
        '/projects/myproject/prs/review',
        {
          Authorization: `Bearer ${TEST_ACCESS_KEY}`,
          'Content-Type': 'application/json',
        },
        JSON.stringify({ repo: 'owner/repo' }),
      );
      expect(status).toBe(400);
      expect(json).toEqual({
        ok: false,
        error: 'Missing required fields: action, repo, prNumber',
      });
    });

    it('returns 400 for invalid action', async () => {
      const { status, json } = await makeRequest(
        'POST',
        '/projects/myproject/prs/review',
        {
          Authorization: `Bearer ${TEST_ACCESS_KEY}`,
          'Content-Type': 'application/json',
        },
        JSON.stringify({
          action: 'INVALID',
          repo: 'owner/repo',
          prNumber: 42,
        }),
      );
      expect(status).toBe(400);
      if (typeof json === 'object' && json !== null && 'error' in json) {
        expect(String(json['error'])).toContain('Invalid action');
      }
    });

    it('returns ok:true for successful review', async () => {
      mockUseCase.executeReview.mockResolvedValue({ ok: true });
      const { status, json } = await makeRequest(
        'POST',
        '/projects/myproject/prs/review',
        {
          Authorization: `Bearer ${TEST_ACCESS_KEY}`,
          'Content-Type': 'application/json',
        },
        JSON.stringify({
          action: 'APPROVE',
          repo: 'owner/repo',
          prNumber: 42,
          projectItemId: 'PVTI_x',
          projectId: 'PVT_y',
          statusFieldId: 'PVTF_z',
          awaitingWorkspaceStatusOptionId: 'opt_aw',
        }),
      );
      expect(status).toBe(200);
      expect(json).toEqual({ ok: true });
    });

    it('returns ok:false and error message for failed review', async () => {
      mockUseCase.executeReview.mockResolvedValue({
        ok: false,
        error: 'Can not approve your own pull request',
      });
      const { status, json } = await makeRequest(
        'POST',
        '/projects/myproject/prs/review',
        {
          Authorization: `Bearer ${TEST_ACCESS_KEY}`,
          'Content-Type': 'application/json',
        },
        JSON.stringify({
          action: 'APPROVE',
          repo: 'owner/repo',
          prNumber: 42,
          projectItemId: 'PVTI_x',
          projectId: 'PVT_y',
          statusFieldId: 'PVTF_z',
          awaitingWorkspaceStatusOptionId: 'opt_aw',
        }),
      );
      expect(status).toBe(400);
      expect(json).toEqual({
        ok: false,
        error: 'Can not approve your own pull request',
      });
    });

    it('does not return 5xx - catches errors and returns 4xx', async () => {
      mockUseCase.executeReview.mockRejectedValue(new Error('Unexpected failure'));
      const { status, json } = await makeRequest(
        'POST',
        '/projects/myproject/prs/review',
        {
          Authorization: `Bearer ${TEST_ACCESS_KEY}`,
          'Content-Type': 'application/json',
        },
        JSON.stringify({
          action: 'APPROVE',
          repo: 'owner/repo',
          prNumber: 42,
          projectItemId: 'PVTI_x',
          projectId: 'PVT_y',
          statusFieldId: 'PVTF_z',
          awaitingWorkspaceStatusOptionId: 'opt_aw',
        }),
      );
      expect(status).toBeLessThan(500);
      if (typeof json === 'object' && json !== null && 'ok' in json) {
        expect(json['ok']).toBe(false);
      }
    });
  });

  describe('GET /image-proxy', () => {
    it('rejects without access key', async () => {
      const { status } = await makeRequest(
        'GET',
        '/image-proxy?url=https%3A%2F%2Fprivate-user-images.githubusercontent.com%2Ftest.png',
      );
      expect(status).toBe(403);
    });

    it('rejects disallowed hostname with 400', async () => {
      const { status, json } = await makeRequest(
        'GET',
        '/image-proxy?url=https%3A%2F%2Fevil.example.com%2Fimage.png',
        { Authorization: `Bearer ${TEST_ACCESS_KEY}` },
      );
      expect(status).toBe(400);
      if (typeof json === 'object' && json !== null && 'error' in json) {
        expect(String(json['error'])).toContain('Hostname not allowed');
      }
    });

    it('proxies allowed GitHub image URL', async () => {
      const { status } = await makeRequest(
        'GET',
        '/image-proxy?url=https%3A%2F%2Fprivate-user-images.githubusercontent.com%2Ftest.png',
        { Authorization: `Bearer ${TEST_ACCESS_KEY}` },
      );
      expect(status).toBe(200);
      expect(mockGitHubRepo.fetchImageProxy).toHaveBeenCalled();
    });
  });

  describe('GET /issue-title', () => {
    it('rejects without access key', async () => {
      const { status } = await makeRequest(
        'GET',
        '/issue-title?owner=owner&repo=repo&number=1',
      );
      expect(status).toBe(403);
    });

    it('returns 400 when parameters are missing', async () => {
      const { status } = await makeRequest(
        'GET',
        '/issue-title?owner=owner',
        { Authorization: `Bearer ${TEST_ACCESS_KEY}` },
      );
      expect(status).toBe(400);
    });

    it('returns issue title info', async () => {
      const { status, json } = await makeRequest(
        'GET',
        '/issue-title?owner=owner&repo=repo&number=1',
        { Authorization: `Bearer ${TEST_ACCESS_KEY}` },
      );
      expect(status).toBe(200);
      expect(json).toMatchObject({ title: 'Test Issue', state: 'open' });
    });
  });

  describe('static file serving', () => {
    it('serves index.html for root path', async () => {
      const { status } = await makeRequest('GET', '/');
      expect(status).toBe(200);
    });

    it('returns 404 for missing static file with fallback to index.html', async () => {
      const { status } = await makeRequest('GET', '/nonexistent-route');
      expect(status).toBe(200);
    });

    it('rejects path traversal attempts', async () => {
      const { status } = await makeRequest('GET', '/../etc/passwd');
      expect(status).toBe(400);
    });
  });

  describe('graceful shutdown', () => {
    it('stops accepting new connections after stop()', async () => {
      await server.stop();
      await expect(makeRequest('GET', '/health')).rejects.toThrow();
      server = new PrReviewViewerHttpServer(
        mockUseCase,
        mockGitHubRepo,
        TEST_ACCESS_KEY,
        TEST_STATIC_DIR,
      );
      await server.start(TEST_HOST, TEST_PORT);
    });
  });
});
