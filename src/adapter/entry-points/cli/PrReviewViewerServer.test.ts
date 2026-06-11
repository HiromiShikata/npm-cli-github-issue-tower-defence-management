import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { createPrReviewViewerServer } from './PrReviewViewerServer';

const TEST_PORT = 19876;
const TEST_ACCESS_KEY = 'test-access-key-123';
const DATA_DIR = path.join(
  __dirname,
  '../../../../../tmp/test-pr-viewer-server',
);
const STATIC_DIR = path.join(DATA_DIR, 'static');

const parseJsonAs = <T>(text: string, guard: (v: unknown) => v is T): T => {
  const parsed: unknown = JSON.parse(text);
  if (!guard(parsed)) throw new Error('Unexpected JSON shape');
  return parsed;
};

const isOkError = (v: unknown): v is { ok: boolean; error: string } =>
  typeof v === 'object' && v !== null && 'ok' in v && 'error' in v;

const isStoriesItems = (
  v: unknown,
): v is { stories: unknown[]; items: unknown[] } => {
  if (typeof v !== 'object' || v === null) return false;
  if (!('stories' in v) || !('items' in v)) return false;
  const narrowed: { stories: unknown; items: unknown } = v;
  return Array.isArray(narrowed.stories) && Array.isArray(narrowed.items);
};

const isDetailResult = (
  v: unknown,
): v is { issue: { title: string }; pr: { number: number } } => {
  if (typeof v !== 'object' || v === null) return false;
  if (!('issue' in v) || !('pr' in v)) return false;
  const narrowed: { issue: unknown; pr: unknown } = v;
  return (
    typeof narrowed.issue === 'object' &&
    narrowed.issue !== null &&
    typeof narrowed.pr === 'object' &&
    narrowed.pr !== null
  );
};

const makeRequest = (
  method: string,
  urlPath: string,
  headers: Record<string, string> = {},
  body?: string,
): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    const req = http.request(options, (res) => {
      const chunks: Uint8Array[] = [];
      res.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          body: chunks.map((c) => Buffer.from(c).toString()).join(''),
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });

describe('PrReviewViewerServer', () => {
  let server: http.Server;

  beforeAll(() => {
    fs.mkdirSync(STATIC_DIR, { recursive: true });
    fs.mkdirSync(path.join(DATA_DIR, 'testproject'), { recursive: true });

    fs.writeFileSync(
      path.join(STATIC_DIR, 'index.html'),
      '<html><body>PR Viewer</body></html>',
    );

    const listData = {
      stories: [{ name: 'Story A', color: '#ff0000', order: 0 }],
      items: [
        {
          issue: {
            number: 1,
            title: 'Task 1',
            author: 'dev',
            url: 'https://github.com/o/r/issues/1',
            story: 'Story A',
            projectItemId: 'PVTI_1',
          },
          pr: {
            number: 10,
            repo: 'o/r',
            title: 'PR 10',
            additions: 5,
            deletions: 2,
            changedFiles: 1,
            url: 'https://github.com/o/r/pull/10',
          },
          changedDirectories: ['src/api'],
        },
      ],
    };
    fs.writeFileSync(
      path.join(DATA_DIR, 'testproject', 'list.json'),
      JSON.stringify(listData),
    );

    const detailDir = path.join(DATA_DIR, 'testproject', 'details', 'o_r');
    fs.mkdirSync(detailDir, { recursive: true });
    const detailData = {
      issue: {
        number: 1,
        title: 'Task 1',
        body: 'Issue body',
        author: 'dev',
        comments: [],
      },
      pr: {
        number: 10,
        title: 'PR 10',
        body: 'PR body',
        headSha: 'abc123',
        files: [],
      },
    };
    fs.writeFileSync(
      path.join(detailDir, '10.json'),
      JSON.stringify(detailData),
    );

    server = createPrReviewViewerServer({
      accessKey: TEST_ACCESS_KEY,
      staticDir: STATIC_DIR,
      dataDir: DATA_DIR,
      host: 'localhost',
      port: TEST_PORT,
      ghToken: 'test-token',
    });
    return new Promise<void>((resolve) =>
      server.listen(TEST_PORT, 'localhost', resolve),
    );
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  describe('access key validation', () => {
    it('returns 403 for list endpoint without access key', async () => {
      const result = await makeRequest(
        'GET',
        '/projects/testproject/prs/data/list',
      );
      expect(result.status).toBe(403);
      const body = parseJsonAs(result.body, isOkError);
      expect(body.ok).toBe(false);
    });

    it('returns 200 for list endpoint with correct access key header', async () => {
      const result = await makeRequest(
        'GET',
        '/projects/testproject/prs/data/list',
        {
          'X-Access-Key': TEST_ACCESS_KEY,
        },
      );
      expect(result.status).toBe(200);
    });

    it('returns 403 for list endpoint with wrong access key', async () => {
      const result = await makeRequest(
        'GET',
        '/projects/testproject/prs/data/list',
        {
          'X-Access-Key': 'wrong-key',
        },
      );
      expect(result.status).toBe(403);
    });
  });

  describe('list endpoint', () => {
    it('returns list data filtered by done set', async () => {
      const result = await makeRequest(
        'GET',
        '/projects/testproject/prs/data/list',
        {
          'X-Access-Key': TEST_ACCESS_KEY,
        },
      );
      expect(result.status).toBe(200);
      const body = parseJsonAs(result.body, isStoriesItems);
      expect(body.stories).toHaveLength(1);
      expect(body.items).toHaveLength(1);
    });

    it('returns empty items for non-existent project', async () => {
      const result = await makeRequest(
        'GET',
        '/projects/nonexistent/prs/data/list',
        {
          'X-Access-Key': TEST_ACCESS_KEY,
        },
      );
      expect(result.status).toBe(200);
      const body = parseJsonAs(result.body, isStoriesItems);
      expect(body.items).toHaveLength(0);
    });
  });

  describe('detail endpoint', () => {
    it('returns detail data for existing PR', async () => {
      const result = await makeRequest(
        'GET',
        '/projects/testproject/prs/data/o/r/10',
        {
          'X-Access-Key': TEST_ACCESS_KEY,
        },
      );
      expect(result.status).toBe(200);
      const body = parseJsonAs(result.body, isDetailResult);
      expect(body.issue.title).toBe('Task 1');
      expect(body.pr.number).toBe(10);
    });

    it('returns 404 for non-existent PR', async () => {
      const result = await makeRequest(
        'GET',
        '/projects/testproject/prs/data/o/r/999',
        {
          'X-Access-Key': TEST_ACCESS_KEY,
        },
      );
      expect(result.status).toBe(404);
    });
  });

  describe('review endpoint', () => {
    it('returns 400 for invalid action', async () => {
      const result = await makeRequest(
        'POST',
        '/projects/testproject/prs/review',
        { 'X-Access-Key': TEST_ACCESS_KEY },
        JSON.stringify({
          action: 'INVALID',
          repo: 'o/r',
          prNumber: 10,
          projectItemId: 'PVTI_1',
          inlineComments: [],
        }),
      );
      expect(result.status).toBe(400);
    });

    it('returns 400 for missing required fields', async () => {
      const result = await makeRequest(
        'POST',
        '/projects/testproject/prs/review',
        { 'X-Access-Key': TEST_ACCESS_KEY },
        JSON.stringify({ action: 'APPROVE' }),
      );
      expect(result.status).toBe(400);
    });

    it('returns 400 for invalid JSON body', async () => {
      const result = await makeRequest(
        'POST',
        '/projects/testproject/prs/review',
        { 'X-Access-Key': TEST_ACCESS_KEY },
        'not valid json',
      );
      expect(result.status).toBe(400);
    });
  });

  describe('CORS', () => {
    it('responds to OPTIONS preflight with 204', async () => {
      const result = await makeRequest(
        'OPTIONS',
        '/projects/testproject/prs/data/list',
      );
      expect(result.status).toBe(204);
    });
  });

  describe('static file serving', () => {
    it('serves index.html for viewer route', async () => {
      const result = await makeRequest('GET', '/projects/testproject/prs');
      expect(result.status).toBe(200);
      expect(result.body).toContain('PR Viewer');
    });

    it('responds with Referrer-Policy no-referrer header for HTML', async () => {
      return new Promise<void>((resolve, reject) => {
        const options: http.RequestOptions = {
          hostname: 'localhost',
          port: TEST_PORT,
          path: '/projects/testproject/prs',
          method: 'GET',
        };
        const req = http.request(options, (res) => {
          expect(res.headers['referrer-policy']).toBe('no-referrer');
          resolve();
        });
        req.on('error', reject);
        req.end();
      });
    });
  });
});
