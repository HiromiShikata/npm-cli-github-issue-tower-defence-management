import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { mock } from 'jest-mock-extended';
import type { Issue } from '../../../domain/entities/Issue';
import type { Project } from '../../../domain/entities/Project';
import type { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { startWebServer, stopWebServer } from './webServer';

const token = 'console-action-idempotency-test-token';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseResponseBody = (body: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(body);
  if (!isRecord(parsed)) {
    throw new Error('response body is not an object');
  }
  return parsed;
};

const project = (): Project => ({
  ...mock<Project>(),
  id: 'PVT_1',
  url: 'https://github.com/acme/projects/1',
  status: {
    name: 'Status',
    fieldId: 'status-field',
    statuses: [
      {
        id: 'status-todo',
        name: 'Todo',
        color: 'BLUE',
        description: '',
      },
    ],
  },
  story: {
    name: 'Story',
    fieldId: 'story-field',
    databaseId: 1,
    stories: [
      {
        id: 'story-one',
        name: 'Story one',
        color: 'BLUE',
        description: '',
      },
    ],
    workflowManagementStory: { id: 'workflow', name: 'Workflow' },
  },
});

const request = (
  server: http.Server,
  requestPath: string,
  body: Record<string, unknown>,
): Promise<{ statusCode: number; body: Record<string, unknown> }> => {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('server is not listening on a TCP port');
  }
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const httpRequest = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        path: `${requestPath}?k=${token}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (response) => {
        const chunks: Uint8Array[] = [];
        response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: parseResponseBody(Buffer.concat(chunks).toString('utf8')),
          });
        });
      },
    );
    httpRequest.on('error', reject);
    httpRequest.end(payload);
  });
};

const serverOptions = (
  dataDir: string,
  issueRepository: ReturnType<typeof mock<IssueRepository>>,
) => ({
  accessToken: token,
  uiDistDir: path.join(dataDir, 'ui-dist'),
  consoleDataOutputDir: dataDir,
  inTmuxDataDir: null,
  dashboardDir: null,
  dashboardDataDir: null,
  dashboardProjectNames: [],
  issueRepository,
  resolveProject: async (pjcode: string) =>
    pjcode === 'acme' ? { pjcode, project: project() } : null,
  isPjcodeConfigured: (pjcode: string) => pjcode === 'acme',
  port: 0,
});

const runFreshServerRequest = async (
  dataDir: string,
  issueRepository: ReturnType<typeof mock<IssueRepository>>,
  body: Record<string, unknown>,
): Promise<{ statusCode: number; body: Record<string, unknown> }> => {
  let result: { statusCode: number; body: Record<string, unknown> } | null =
    null;
  await jest.isolateModulesAsync(async () => {
    const isolatedWebServer = await import('./webServer');
    const server = await isolatedWebServer.startWebServer(
      serverOptions(dataDir, issueRepository),
    );
    try {
      result = await request(server, '/api/triage', body);
    } finally {
      await isolatedWebServer.stopWebServer(server);
    }
  });
  if (result === null) {
    throw new Error('isolated server did not return a response');
  }
  return result;
};

const closeBody = {
  pjcode: 'acme',
  action: 'close',
  actionId: 'close-action-once',
  issueUrl: 'https://github.com/acme/repo/issues/1',
  projectItemId: 'PVTI_close_once',
  commentBody: 'ok',
};

const storyBody = {
  pjcode: 'acme',
  action: 'set_story',
  actionId: 'story-action-once',
  issueUrl: 'https://github.com/acme/repo/issues/1',
  projectItemId: 'PVTI_story_once',
  storyOptionId: 'story-one',
};

describe('console operation actionId delivery', () => {
  let dataDir: string;
  let issueRepository: ReturnType<typeof mock<IssueRepository>>;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-action-id-'));
    issueRepository = mock<IssueRepository>();
    issueRepository.get.mockResolvedValue({
      ...mock<Issue>(),
      url: closeBody.issueUrl,
      itemId: 'PVTI_close_once',
    });
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('executes a repeated close request once and returns the first response as a duplicate', async () => {
    const server = await startWebServer(
      serverOptions(dataDir, issueRepository),
    );
    try {
      const first = await request(server, '/api/triage', closeBody);
      const second = await request(server, '/api/triage', closeBody);

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(second.body).toMatchObject({ ok: true, duplicate: true });
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledTimes(1);
      expect(issueRepository.closeIssueByUrl).toHaveBeenCalledTimes(1);
    } finally {
      await stopWebServer(server);
    }
  });

  it('executes a repeated set_story request once and returns the first response as a duplicate', async () => {
    const server = await startWebServer(
      serverOptions(dataDir, issueRepository),
    );
    try {
      const first = await request(server, '/api/triage', storyBody);
      const second = await request(server, '/api/triage', storyBody);

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(second.body).toMatchObject({ ok: true, duplicate: true });
      expect(issueRepository.updateStory).toHaveBeenCalledTimes(1);
    } finally {
      await stopWebServer(server);
    }
  });

  it('shares one close execution between concurrent identical requests', async () => {
    let releaseClose: () => void = () => undefined;
    const closeReleased = new Promise<void>((resolve) => {
      releaseClose = resolve;
    });
    issueRepository.closeIssueByUrl.mockImplementation(async () => {
      await closeReleased;
    });
    const server = await startWebServer(
      serverOptions(dataDir, issueRepository),
    );
    try {
      const firstPromise = request(server, '/api/triage', closeBody);
      await Promise.resolve();
      const secondPromise = request(server, '/api/triage', closeBody);
      releaseClose();
      const [first, second] = await Promise.all([firstPromise, secondPromise]);

      expect(first.statusCode).toBe(200);
      expect(second.body).toMatchObject({ ok: true, duplicate: true });
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledTimes(1);
      expect(issueRepository.closeIssueByUrl).toHaveBeenCalledTimes(1);
    } finally {
      await stopWebServer(server);
    }
  });

  it('retries a failed close request with the same actionId', async () => {
    issueRepository.closeIssueByUrl.mockRejectedValueOnce(
      new Error('close failed'),
    );
    const server = await startWebServer(
      serverOptions(dataDir, issueRepository),
    );
    try {
      const first = await request(server, '/api/triage', closeBody);
      const second = await request(server, '/api/triage', closeBody);

      expect(first.statusCode).toBe(502);
      expect(second.statusCode).toBe(200);
      expect(second.body).toMatchObject({ ok: true });
      expect(second.body).not.toHaveProperty('duplicate');
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledTimes(2);
      expect(issueRepository.closeIssueByUrl).toHaveBeenCalledTimes(2);
    } finally {
      await stopWebServer(server);
    }
  });

  it('does not post a failed set_status comment only once', async () => {
    issueRepository.createCommentByUrl.mockRejectedValueOnce(
      new Error('comment failed'),
    );
    const body = {
      pjcode: 'acme',
      action: 'set_status',
      actionId: 'failed-comment-action',
      issueUrl: 'https://github.com/acme/repo/issues/1',
      projectItemId: 'PVTI_failed_comment',
      statusName: 'Todo',
      commentBody: 'retry me',
    };
    const server = await startWebServer(
      serverOptions(dataDir, issueRepository),
    );
    try {
      const first = await request(server, '/api/triage', body);
      const second = await request(server, '/api/triage', body);

      expect(first.statusCode).toBe(200);
      expect(first.body).toMatchObject({ ok: false, commentPosted: false });
      expect(second.body).toMatchObject({ ok: true, commentPosted: true });
      expect(second.body).not.toHaveProperty('duplicate');
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledTimes(2);
    } finally {
      await stopWebServer(server);
    }
  });

  it('remembers a successful set_status comment across a fresh server context', async () => {
    const body = {
      pjcode: 'acme',
      action: 'set_status',
      actionId: 'restart-action',
      issueUrl: 'https://github.com/acme/repo/issues/1',
      projectItemId: 'PVTI_restart',
      statusName: 'Todo',
      commentBody: 'survive restart',
    };

    await runFreshServerRequest(dataDir, issueRepository, body);
    const replay = await runFreshServerRequest(dataDir, issueRepository, body);

    expect(replay.statusCode).toBe(200);
    expect(replay.body).toMatchObject({
      ok: true,
      commentPosted: true,
      duplicate: true,
    });
    expect(issueRepository.createCommentByUrl).toHaveBeenCalledTimes(1);
  });
});
