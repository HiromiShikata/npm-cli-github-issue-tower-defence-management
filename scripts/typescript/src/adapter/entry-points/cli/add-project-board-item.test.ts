import { execFile, spawnSync } from 'child_process';
import * as http from 'http';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

describe('add-project-board-item CLI', () => {
  const scriptsTypescriptDir = path.join(__dirname, '../../../..');
  const command =
    'npx tsx src/adapter/entry-points/cli/add-project-board-item.ts';
  const baseEnv = (env: Record<string, string>): Record<string, string> => ({
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: process.env.HOME ?? '/root',
    ...env,
  });

  const runCli = (
    env: Record<string, string>,
  ): { status: number | null; stderr: string } => {
    const result = spawnSync('bash', ['--noprofile', '--norc', '-c', command], {
      encoding: 'utf8',
      cwd: scriptsTypescriptDir,
      env: baseEnv(env),
    });
    return { status: result.status, stderr: result.stderr };
  };

  type MissingEnvironmentVariableCase = {
    name: string;
    env: Record<string, string>;
    expectedMissingVariableMessage: string;
  };

  const missingEnvironmentVariableCases: MissingEnvironmentVariableCase[] = [
    {
      name: 'exits 1 and reports GH_TOKEN missing when no environment variables are set',
      env: {},
      expectedMissingVariableMessage:
        'GH_TOKEN environment variable is not set',
    },
    {
      name: 'exits 1 and reports PROJECT_V2_ID missing when only GH_TOKEN is set',
      env: { GH_TOKEN: 'test-gh-token' },
      expectedMissingVariableMessage:
        'PROJECT_V2_ID environment variable is not set',
    },
    {
      name: 'exits 1 and reports STATUS_FIELD_ID missing when GH_TOKEN and PROJECT_V2_ID are set',
      env: {
        GH_TOKEN: 'test-gh-token',
        PROJECT_V2_ID: 'PVT_testProjectId',
      },
      expectedMissingVariableMessage:
        'STATUS_FIELD_ID environment variable is not set',
    },
    {
      name: 'exits 1 and reports AWAITING_WORKSPACE_OPTION_ID missing when GH_TOKEN, PROJECT_V2_ID and STATUS_FIELD_ID are set',
      env: {
        GH_TOKEN: 'test-gh-token',
        PROJECT_V2_ID: 'PVT_testProjectId',
        STATUS_FIELD_ID: 'PVTSSF_testStatusFieldId',
      },
      expectedMissingVariableMessage:
        'AWAITING_WORKSPACE_OPTION_ID environment variable is not set',
    },
    {
      name: 'exits 1 and reports EVENT_ACTION missing when GH_TOKEN, PROJECT_V2_ID, STATUS_FIELD_ID and AWAITING_WORKSPACE_OPTION_ID are set',
      env: {
        GH_TOKEN: 'test-gh-token',
        PROJECT_V2_ID: 'PVT_testProjectId',
        STATUS_FIELD_ID: 'PVTSSF_testStatusFieldId',
        AWAITING_WORKSPACE_OPTION_ID: 'testOptionId',
      },
      expectedMissingVariableMessage:
        'EVENT_ACTION environment variable is not set',
    },
  ];

  it.each(missingEnvironmentVariableCases)(
    '$name',
    ({ env, expectedMissingVariableMessage }) => {
      const result = runCli(env);

      expect(result.status).toBe(1);
      expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
      expect(result.stderr).toContain(expectedMissingVariableMessage);
    },
  );

  type GraphqlMockRequestBody = { query: string };

  const isGraphqlMockRequestBody = (
    value: unknown,
  ): value is GraphqlMockRequestBody => {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    if (!('query' in value) || typeof value.query !== 'string') {
      return false;
    }
    return true;
  };

  type ProjectItemGraphqlMockServer = {
    baseUrl: string;
    receivedCallCount: () => number;
    close: () => Promise<void>;
  };

  const startProjectItemGraphqlMockServer = (
    fakeItemId: string,
  ): Promise<ProjectItemGraphqlMockServer> =>
    new Promise((resolve, reject) => {
      let receivedCallCount = 0;
      const server = http.createServer((request, response) => {
        const chunks: Buffer[] = [];
        request.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        request.on('end', () => {
          receivedCallCount += 1;
          const parsedBody: unknown = JSON.parse(
            Buffer.concat(chunks).toString('utf8'),
          );
          response.setHeader('content-type', 'application/json');
          if (!isGraphqlMockRequestBody(parsedBody)) {
            response.writeHead(400);
            response.end(
              JSON.stringify({
                errors: [{ message: 'malformed GraphQL request body' }],
              }),
            );
            return;
          }
          if (parsedBody.query.includes('addProjectV2ItemById')) {
            response.writeHead(200);
            response.end(
              JSON.stringify({
                data: { addProjectV2ItemById: { item: { id: fakeItemId } } },
              }),
            );
            return;
          }
          if (parsedBody.query.includes('updateProjectV2ItemFieldValue')) {
            response.writeHead(200);
            response.end(
              JSON.stringify({
                data: {
                  updateProjectV2ItemFieldValue: {
                    projectV2Item: { id: fakeItemId },
                  },
                },
              }),
            );
            return;
          }
          response.writeHead(500);
          response.end(
            JSON.stringify({
              errors: [
                {
                  message: `unexpected GraphQL operation in test mock: ${parsedBody.query}`,
                },
              ],
            }),
          );
        });
      });
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address === null || typeof address === 'string') {
          reject(
            new Error(
              'Expected the mock GraphQL server to listen on a TCP port',
            ),
          );
          return;
        }
        resolve({
          baseUrl: `http://127.0.0.1:${address.port}`,
          receivedCallCount: () => receivedCallCount,
          close: () =>
            new Promise((closeResolve) => {
              server.close(() => closeResolve());
            }),
        });
      });
    });

  const isExecFileError = (
    error: unknown,
  ): error is { stdout: string; stderr: string; code: unknown } => {
    if (typeof error !== 'object' || error === null) {
      return false;
    }
    if (
      !('stdout' in error) ||
      !('stderr' in error) ||
      !('code' in error) ||
      typeof error.stdout !== 'string' ||
      typeof error.stderr !== 'string'
    ) {
      return false;
    }
    return true;
  };

  const runCliAsync = async (
    env: Record<string, string>,
  ): Promise<{ status: number; stdout: string; stderr: string }> => {
    try {
      const { stdout, stderr } = await execFileAsync(
        'bash',
        ['--noprofile', '--norc', '-c', command],
        {
          encoding: 'utf8',
          cwd: scriptsTypescriptDir,
          env: baseEnv(env),
        },
      );
      return { status: 0, stdout, stderr };
    } catch (error) {
      if (isExecFileError(error)) {
        return {
          status: typeof error.code === 'number' ? error.code : 1,
          stdout: error.stdout,
          stderr: error.stderr,
        };
      }
      throw error;
    }
  };

  test(
    'exits 0 and prints the resolved project item id when run end to end against a mocked GraphQL endpoint',
    async () => {
      const fakeItemId = 'PVTI_fakeMockItemId';
      const mockServer = await startProjectItemGraphqlMockServer(fakeItemId);
      try {
        const result = await runCliAsync({
          GH_TOKEN: 'test-gh-token',
          PROJECT_V2_ID: 'PVT_testProjectId',
          STATUS_FIELD_ID: 'PVTSSF_testStatusFieldId',
          AWAITING_WORKSPACE_OPTION_ID: 'testOptionId',
          EVENT_ACTION: 'reopened',
          ISSUE_NODE_ID: 'I_testIssueNodeId',
          GH_API_BASE_URL: mockServer.baseUrl,
        });

        expect(result.status).toBe(0);
        expect(result.stdout).toContain(
          `Resolved project item id: ${fakeItemId}`,
        );
        expect(mockServer.receivedCallCount()).toBe(2);
      } finally {
        await mockServer.close();
      }
    },
    30000,
  );
});
