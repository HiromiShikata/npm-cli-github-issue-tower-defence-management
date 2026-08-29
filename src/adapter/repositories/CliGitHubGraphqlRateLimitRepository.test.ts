import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { CliGitHubGraphqlRateLimitRepository } from './CliGitHubGraphqlRateLimitRepository';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

describe('CliGitHubGraphqlRateLimitRepository', () => {
  let mockLocalCommandRunner: Mocked<LocalCommandRunner>;
  let repository: CliGitHubGraphqlRateLimitRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    mockLocalCommandRunner = {
      runCommand: jest.fn(),
      spawnInteractive: jest.fn(),
    };
    repository = new CliGitHubGraphqlRateLimitRepository(mockLocalCommandRunner);
  });

  it('returns the remaining GraphQL request count when gh succeeds', async () => {
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '4873\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await repository.getRemainingRequestCount();

    expect(result).toBe(4873);
    expect(mockLocalCommandRunner.runCommand).toHaveBeenCalledWith('gh', [
      'api',
      'rate_limit',
      '--jq',
      '.resources.graphql.remaining',
    ]);
  });

  it('returns null when gh exits with a non-zero code', async () => {
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: 'error: authentication required',
      exitCode: 1,
    });

    const result = await repository.getRemainingRequestCount();

    expect(result).toBeNull();
  });

  it('returns null when the output is not a valid integer', async () => {
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: 'not-a-number\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await repository.getRemainingRequestCount();

    expect(result).toBeNull();
  });

  it('returns zero when the remaining count is zero', async () => {
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '0\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await repository.getRemainingRequestCount();

    expect(result).toBe(0);
  });
});
