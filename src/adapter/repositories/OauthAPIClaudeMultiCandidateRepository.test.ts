import { OauthAPIClaudeMultiCandidateRepository } from './OauthAPIClaudeMultiCandidateRepository';
import {
  ClaudeConfigDirCandidateUnavailableError,
  OauthAPIClaudeRepository,
} from './OauthAPIClaudeRepository';
import * as fs from 'fs';

jest.mock('./OauthAPIClaudeRepository');
jest.mock('fs');

const MockOauthAPIClaudeRepository = jest.mocked(OauthAPIClaudeRepository);
const mockCopyFileSync = jest.mocked(fs.copyFileSync);
const mockRenameSync = jest.mocked(fs.renameSync);
const mockExistsSync = jest.mocked(fs.existsSync);

describe('OauthAPIClaudeMultiCandidateRepository', () => {
  const homeDir = '/home/testuser';
  const threshold = 90;
  const mainDir = `${homeDir}/.claude`;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  describe('isClaudeAvailable', () => {
    describe('when no candidates configured', () => {
      it('should return true when main repo non-weekly usage is under threshold', async () => {
        MockOauthAPIClaudeRepository.prototype.getUsage.mockResolvedValue([
          { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
        ]);

        const repo = new OauthAPIClaudeMultiCandidateRepository([], homeDir);
        const result = await repo.isClaudeAvailable(threshold);

        expect(result).toBe(true);
        expect(MockOauthAPIClaudeRepository).toHaveBeenCalledWith(mainDir);
        expect(mockCopyFileSync).not.toHaveBeenCalled();
      });

      it('should return false when main repo non-weekly usage exceeds threshold', async () => {
        MockOauthAPIClaudeRepository.prototype.getUsage.mockResolvedValue([
          { hour: 5, utilizationPercentage: 95, resetsAt: new Date() },
        ]);

        const repo = new OauthAPIClaudeMultiCandidateRepository([], homeDir);
        const result = await repo.isClaudeAvailable(threshold);

        expect(result).toBe(false);
        expect(mockCopyFileSync).not.toHaveBeenCalled();
      });

      it('should return true when only weekly usage exceeds threshold', async () => {
        MockOauthAPIClaudeRepository.prototype.getUsage.mockResolvedValue([
          { hour: 168, utilizationPercentage: 99, resetsAt: new Date() },
          { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
        ]);

        const repo = new OauthAPIClaudeMultiCandidateRepository([], homeDir);
        const result = await repo.isClaudeAvailable(threshold);

        expect(result).toBe(true);
        expect(mockCopyFileSync).not.toHaveBeenCalled();
      });

      it('should return true when no usage windows are available', async () => {
        MockOauthAPIClaudeRepository.prototype.getUsage.mockResolvedValue([]);

        const repo = new OauthAPIClaudeMultiCandidateRepository([], homeDir);
        const result = await repo.isClaudeAvailable(threshold);

        expect(result).toBe(true);
      });
    });

    describe('when candidates are configured', () => {
      it('should copy credentials atomically and return true when first candidate is under threshold', async () => {
        MockOauthAPIClaudeRepository.prototype.getUsage.mockResolvedValue([
          { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
        ]);

        const repo = new OauthAPIClaudeMultiCandidateRepository(
          ['.claude-candidate1', '.claude-candidate2'],
          homeDir,
        );
        const result = await repo.isClaudeAvailable(threshold);

        expect(result).toBe(true);
        expect(MockOauthAPIClaudeRepository).toHaveBeenCalledWith(
          `${homeDir}/.claude-candidate1`,
        );
        expect(mockCopyFileSync).toHaveBeenCalledWith(
          `${homeDir}/.claude-candidate1/.credentials.json`,
          `${mainDir}/.credentials.json.tmp`,
        );
        expect(mockRenameSync).toHaveBeenCalledWith(
          `${mainDir}/.credentials.json.tmp`,
          `${mainDir}/.credentials.json`,
        );
      });

      it('should copy .claude.json when it exists in candidate directory', async () => {
        MockOauthAPIClaudeRepository.prototype.getUsage.mockResolvedValue([
          { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
        ]);
        mockExistsSync.mockReturnValue(true);

        const repo = new OauthAPIClaudeMultiCandidateRepository(
          ['.claude-candidate1'],
          homeDir,
        );
        await repo.isClaudeAvailable(threshold);

        expect(mockCopyFileSync).toHaveBeenCalledWith(
          `${homeDir}/.claude-candidate1/.claude.json`,
          `${mainDir}/.claude.json.tmp`,
        );
        expect(mockRenameSync).toHaveBeenCalledWith(
          `${mainDir}/.claude.json.tmp`,
          `${mainDir}/.claude.json`,
        );
      });

      it('should not copy .claude.json when it does not exist in candidate directory', async () => {
        MockOauthAPIClaudeRepository.prototype.getUsage.mockResolvedValue([
          { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
        ]);
        mockExistsSync.mockReturnValue(false);

        const repo = new OauthAPIClaudeMultiCandidateRepository(
          ['.claude-candidate1'],
          homeDir,
        );
        await repo.isClaudeAvailable(threshold);

        expect(mockCopyFileSync).not.toHaveBeenCalledWith(
          expect.stringContaining('.claude.json'),
          expect.anything(),
        );
      });

      it('should skip first candidate and copy second when first exceeds threshold', async () => {
        MockOauthAPIClaudeRepository.prototype.getUsage
          .mockResolvedValueOnce([
            { hour: 5, utilizationPercentage: 95, resetsAt: new Date() },
          ])
          .mockResolvedValueOnce([
            { hour: 5, utilizationPercentage: 40, resetsAt: new Date() },
          ]);

        const repo = new OauthAPIClaudeMultiCandidateRepository(
          ['.claude-candidate1', '.claude-candidate2'],
          homeDir,
        );
        const result = await repo.isClaudeAvailable(threshold);

        expect(result).toBe(true);
        expect(MockOauthAPIClaudeRepository).toHaveBeenCalledWith(
          `${homeDir}/.claude-candidate1`,
        );
        expect(MockOauthAPIClaudeRepository).toHaveBeenCalledWith(
          `${homeDir}/.claude-candidate2`,
        );
        expect(mockCopyFileSync).toHaveBeenCalledWith(
          `${homeDir}/.claude-candidate2/.credentials.json`,
          `${mainDir}/.credentials.json.tmp`,
        );
      });

      it('should return false and not copy when all candidates exceed threshold', async () => {
        MockOauthAPIClaudeRepository.prototype.getUsage.mockResolvedValue([
          { hour: 5, utilizationPercentage: 95, resetsAt: new Date() },
        ]);

        const repo = new OauthAPIClaudeMultiCandidateRepository(
          ['.claude-candidate1', '.claude-candidate2'],
          homeDir,
        );
        const result = await repo.isClaudeAvailable(threshold);

        expect(result).toBe(false);
        expect(mockCopyFileSync).not.toHaveBeenCalled();
      });

      it('should skip candidate when ClaudeConfigDirCandidateUnavailableError is thrown', async () => {
        MockOauthAPIClaudeRepository.prototype.getUsage
          .mockRejectedValueOnce(
            new ClaudeConfigDirCandidateUnavailableError(
              'Claude credentials file not found at /some/path',
            ),
          )
          .mockResolvedValueOnce([
            { hour: 5, utilizationPercentage: 40, resetsAt: new Date() },
          ]);

        const repo = new OauthAPIClaudeMultiCandidateRepository(
          ['.claude-candidate1', '.claude-candidate2'],
          homeDir,
        );
        const result = await repo.isClaudeAvailable(threshold);

        expect(result).toBe(true);
        expect(mockCopyFileSync).toHaveBeenCalledWith(
          `${homeDir}/.claude-candidate2/.credentials.json`,
          `${mainDir}/.credentials.json.tmp`,
        );
      });

      it('should propagate non-skippable errors', async () => {
        MockOauthAPIClaudeRepository.prototype.getUsage.mockRejectedValueOnce(
          new Error('Network failure'),
        );

        const repo = new OauthAPIClaudeMultiCandidateRepository(
          ['.claude-candidate1'],
          homeDir,
        );

        await expect(repo.isClaudeAvailable(threshold)).rejects.toThrow(
          'Network failure',
        );
      });

      it('should ignore weekly usage when evaluating candidate threshold', async () => {
        MockOauthAPIClaudeRepository.prototype.getUsage.mockResolvedValue([
          { hour: 168, utilizationPercentage: 99, resetsAt: new Date() },
          { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
        ]);

        const repo = new OauthAPIClaudeMultiCandidateRepository(
          ['.claude-candidate1'],
          homeDir,
        );
        const result = await repo.isClaudeAvailable(threshold);

        expect(result).toBe(true);
        expect(mockCopyFileSync).toHaveBeenCalledWith(
          `${homeDir}/.claude-candidate1/.credentials.json`,
          `${mainDir}/.credentials.json.tmp`,
        );
      });
    });
  });

  describe('getUsage', () => {
    it('should delegate to main repository', async () => {
      const expectedUsages = [
        { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
        { hour: 168, utilizationPercentage: 80, resetsAt: new Date() },
      ];
      MockOauthAPIClaudeRepository.prototype.getUsage.mockResolvedValue(
        expectedUsages,
      );

      const repo = new OauthAPIClaudeMultiCandidateRepository(
        ['.claude-candidate1'],
        homeDir,
      );
      const result = await repo.getUsage();

      expect(result).toBe(expectedUsages);
      expect(MockOauthAPIClaudeRepository).toHaveBeenCalledWith(mainDir);
    });
  });
});
