import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mock } from 'jest-mock-extended';
import type { Issue } from '../../../domain/entities/Issue';
import type { Project } from '../../../domain/entities/Project';
import type { GitHubGraphqlRateLimitRepository } from '../../../domain/usecases/adapter-interfaces/GitHubGraphqlRateLimitRepository';
import type { IssueLatestSessionBranchRepository } from '../../../domain/usecases/adapter-interfaces/IssueLatestSessionBranchRepository';
import type { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import type { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import type { ProjectRepository } from '../../../domain/usecases/adapter-interfaces/ProjectRepository';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { ProcTakeOwnershipSpawnRepository } from '../../repositories/ProcTakeOwnershipSpawnRepository';
import { ProxyClaudeTokenUsageRepository } from '../../repositories/ProxyClaudeTokenUsageRepository';

class InMemoryIssueLatestSessionBranchRepository implements IssueLatestSessionBranchRepository {
  constructor(
    private readonly latestSessionBranchNameByIssueUrl: ReadonlyMap<
      string,
      string
    >,
  ) {}

  findBranchNameByIssue = async (
    issue: Pick<Issue, 'org' | 'repo' | 'number'>,
  ): Promise<string | null> =>
    this.latestSessionBranchNameByIssueUrl.get(
      `https://github.com/${issue.org}/${issue.repo}/issues/${issue.number}`,
    ) ?? null;
}

const createMockProject = (): Project => ({
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-id',
    statuses: [
      { id: '1', name: 'Awaiting Workspace', color: 'GRAY', description: '' },
      { id: '2', name: 'Preparation', color: 'YELLOW', description: '' },
      { id: '3', name: 'Done', color: 'GREEN', description: '' },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
});

const runParams = {
  projectUrl: 'https://github.com/user/repo',
  defaultAgentName: 'agent1',
  defaultLlmModelName: 'claude-opus',
  defaultLlmAgentName: null,
  configFilePath: '/path/to/config.yml',
  maximumPreparingIssuesCount: null,
  utilizationPercentageThreshold: 90,
  allowedIssueAuthors: ['testuser'],
  manager: 'manager-user',
  codexHomeCandidates: null,
  labelsAsLlmAgentName: null,
};

const createUseCase = (
  tokenListPath: string,
  procDirectory: string,
): {
  useCase: StartPreparationUseCase;
  localCommandRunner: jest.Mocked<LocalCommandRunner>;
} => {
  const project = createMockProject();
  const projectRepository = mock<ProjectRepository>();
  projectRepository.getByUrl.mockResolvedValue(project);
  const issueRepository = mock<IssueRepository>();
  issueRepository.getStoryObjectMap.mockResolvedValue(new Map());
  issueRepository.getAllOpened.mockResolvedValue([]);
  const localCommandRunner = mock<LocalCommandRunner>();
  const claudeTokenUsageRepository = new ProxyClaudeTokenUsageRepository(
    tokenListPath,
  );
  const takeOwnershipSpawnRepository = new ProcTakeOwnershipSpawnRepository(
    procDirectory,
  );
  const gitHubGraphqlRateLimitRepository =
    mock<GitHubGraphqlRateLimitRepository>();
  const issueLatestSessionBranchRepository =
    new InMemoryIssueLatestSessionBranchRepository(new Map());

  return {
    useCase: new StartPreparationUseCase(
      projectRepository,
      issueRepository,
      localCommandRunner,
      claudeTokenUsageRepository,
      takeOwnershipSpawnRepository,
      gitHubGraphqlRateLimitRepository,
      issueLatestSessionBranchRepository,
    ),
    localCommandRunner,
  };
};

describe('StartPreparationUseCase read failures', () => {
  it('should reject before starting a worker when the real token list contains malformed JSON', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'start-preparation-read-failure-'),
    );
    try {
      const tokenListPath = path.join(tempDir, 'tokens.json');
      fs.writeFileSync(tokenListPath, '{"token":"test-token",');
      const { useCase, localCommandRunner } = createUseCase(
        tokenListPath,
        path.join(tempDir, 'missing-proc'),
      );

      await expect(useCase.run(runParams)).rejects.toThrow(
        /Unexpected end of JSON input/,
      );
      expect(localCommandRunner.runCommand.mock.calls).toHaveLength(0);
      expect(localCommandRunner.spawnInteractive.mock.calls).toHaveLength(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should reject before starting a worker when the real proc directory cannot be listed', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'start-preparation-proc-failure-'),
    );
    try {
      const tokenListPath = path.join(tempDir, 'tokens.json');
      fs.writeFileSync(
        tokenListPath,
        JSON.stringify([{ name: 'alice', token: 'token-a' }]),
      );
      const { useCase, localCommandRunner } = createUseCase(
        tokenListPath,
        path.join(tempDir, 'missing-proc'),
      );

      await expect(useCase.run(runParams)).rejects.toThrow();
      expect(localCommandRunner.runCommand.mock.calls).toHaveLength(0);
      expect(localCommandRunner.spawnInteractive.mock.calls).toHaveLength(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should resolve when the real token list and proc directory can be read', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'start-preparation-read-success-'),
    );
    try {
      const tokenListPath = path.join(tempDir, 'tokens.json');
      const procDirectory = path.join(tempDir, 'proc');
      fs.writeFileSync(
        tokenListPath,
        JSON.stringify([{ name: 'alice', token: 'token-a' }]),
      );
      fs.mkdirSync(procDirectory);
      const { useCase, localCommandRunner } = createUseCase(
        tokenListPath,
        procDirectory,
      );

      await expect(useCase.run(runParams)).resolves.toMatchObject({
        rotationOrder: [expect.objectContaining({ name: 'alice' })],
      });
      expect(localCommandRunner.runCommand.mock.calls).toHaveLength(0);
      expect(localCommandRunner.spawnInteractive.mock.calls).toHaveLength(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
