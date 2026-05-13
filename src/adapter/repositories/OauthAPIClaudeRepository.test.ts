import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { OauthAPIClaudeRepository } from './OauthAPIClaudeRepository';

jest.mock('fs');
jest.mock('os');

const mockFs = jest.mocked(fs);
const mockOs = jest.mocked(os);

describe('OauthAPIClaudeRepository', () => {
  const homeDir = '/home/testuser';
  const claudeDir = '/home/testuser/.claude';
  const credentialsPath = '/home/testuser/.claude/.credentials.json';

  beforeEach(() => {
    jest.clearAllMocks();
    mockOs.homedir.mockReturnValue(homeDir);
  });

  describe('isClaudeAvailable with claudeCodeOauthTokenListJsonPath', () => {
    const tokenListPath = '/path/to/token-list.json';
    const tokenListContent = JSON.stringify([
      'token-under-threshold',
      'token-over-threshold',
    ]);

    const mockUsageResponseUnderThreshold = {
      five_hour: { utilization: 0.5, resets_at: '2026-05-10T12:00:00Z' },
    };

    const mockUsageResponseOverThreshold = {
      five_hour: { utilization: 0.95, resets_at: '2026-05-10T12:00:00Z' },
    };

    it('should use tokens from token list file when path is provided and file exists', async () => {
      mockFs.existsSync.mockImplementation((p) => p === tokenListPath);
      mockFs.readFileSync.mockReturnValue(tokenListContent);

      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockUsageResponseUnderThreshold), {
          status: 200,
        }),
      );

      const repo = new OauthAPIClaudeRepository(tokenListPath);
      const result = await repo.isClaudeAvailable(0.9);

      expect(result).toBe(true);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(tokenListPath, 'utf-8');
    });

    it('should return false when all tokens in list exceed threshold', async () => {
      mockFs.existsSync.mockImplementation((p) => p === tokenListPath);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify(['token-over-threshold']),
      );

      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockUsageResponseOverThreshold), {
          status: 200,
        }),
      );

      const repo = new OauthAPIClaudeRepository(tokenListPath);
      const result = await repo.isClaudeAvailable(0.9);

      expect(result).toBe(false);
    });

    it('should try next token when current token API call fails', async () => {
      mockFs.existsSync.mockImplementation((p) => p === tokenListPath);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify(['failing-token', 'working-token']),
      );

      jest
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockUsageResponseUnderThreshold), {
            status: 200,
          }),
        );

      const repo = new OauthAPIClaudeRepository(tokenListPath);
      const result = await repo.isClaudeAvailable(0.9);

      expect(result).toBe(true);
    });

    it('should return false when token list file is empty array', async () => {
      mockFs.existsSync.mockImplementation((p) => p === tokenListPath);
      mockFs.readFileSync.mockReturnValue(JSON.stringify([]));

      const repo = new OauthAPIClaudeRepository(tokenListPath);
      const result = await repo.isClaudeAvailable(0.9);

      expect(result).toBe(false);
    });

    it('should skip non-string items in token list', async () => {
      mockFs.existsSync.mockImplementation((p) => p === tokenListPath);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify([123, null, 'valid-token']),
      );

      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockUsageResponseUnderThreshold), {
          status: 200,
        }),
      );

      const repo = new OauthAPIClaudeRepository(tokenListPath);
      const result = await repo.isClaudeAvailable(0.9);

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should fall back to ~/.claude directory when token list file does not exist', async () => {
      mockFs.existsSync.mockImplementation((p) => {
        if (p === tokenListPath) return false;
        if (p === claudeDir) return true;
        return false;
      });
      mockFs.readdirSync.mockReturnValue([]);

      const repo = new OauthAPIClaudeRepository(tokenListPath);
      const result = await repo.isClaudeAvailable(0.9);

      expect(result).toBe(false);
      expect(mockFs.readdirSync).toHaveBeenCalledWith(claudeDir);
    });

    it('should use ~/.claude directory when no token list path is provided', async () => {
      mockFs.existsSync.mockImplementation((p) => p === claudeDir);
      mockFs.readdirSync.mockReturnValue([]);

      const repo = new OauthAPIClaudeRepository();
      const result = await repo.isClaudeAvailable(0.9);

      expect(result).toBe(false);
      expect(mockFs.readdirSync).toHaveBeenCalledWith(claudeDir);
    });

    it('should set selectedAccessToken so getUsage uses it without reading credentials file', async () => {
      mockFs.existsSync.mockImplementation((p) => p === tokenListPath);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(['selected-token']));

      const mockUsageData = {
        five_hour: { utilization: 0.3, resets_at: '2026-05-10T12:00:00Z' },
      };

      jest
        .spyOn(global, 'fetch')
        .mockImplementation(() =>
          Promise.resolve(
            new Response(JSON.stringify(mockUsageData), { status: 200 }),
          ),
        );

      const repo = new OauthAPIClaudeRepository(tokenListPath);
      await repo.isClaudeAvailable(0.9);

      const usages = await repo.getUsage();

      expect(usages).toHaveLength(1);
      expect(usages[0].utilizationPercentage).toBe(0.3);
      expect(mockFs.existsSync).not.toHaveBeenCalledWith(credentialsPath);
    });

    it('should set selectedClaudeConfigDir after isClaudeAvailable selects a token', async () => {
      mockFs.existsSync.mockImplementation((p) => p === tokenListPath);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify(['token-under-threshold']),
      );
      mockFs.mkdtempSync.mockReturnValue('/tmp/tdpm-claude-test');

      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockUsageResponseUnderThreshold), {
          status: 200,
        }),
      );

      const repo = new OauthAPIClaudeRepository(tokenListPath);
      await repo.isClaudeAvailable(0.9);

      expect(repo.getSelectedClaudeConfigDir()).toBe('/tmp/tdpm-claude-test');
      expect(mockFs.mkdtempSync).toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/tdpm-claude-test/.credentials.json',
        JSON.stringify({
          claudeAiOauth: { accessToken: 'token-under-threshold' },
        }),
      );
    });
  });

  describe('getUsage with claudeCodeOauthTokenListJsonPath', () => {
    const tokenListPath = '/path/to/token-list.json';

    it('should select a token from the list and set selectedClaudeConfigDir', async () => {
      mockFs.existsSync.mockImplementation((p) => p === tokenListPath);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(['test-token']));
      mockFs.mkdtempSync.mockReturnValue('/tmp/tdpm-claude-test');

      const mockUsageData = {
        five_hour: { utilization: 0.3, resets_at: '2026-05-10T12:00:00Z' },
      };

      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockUsageData), { status: 200 }),
      );

      const repo = new OauthAPIClaudeRepository(tokenListPath);
      await repo.getUsage();

      expect(repo.getSelectedClaudeConfigDir()).toBe('/tmp/tdpm-claude-test');
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/tdpm-claude-test/.credentials.json',
        JSON.stringify({ claudeAiOauth: { accessToken: 'test-token' } }),
      );
    });
  });

  describe('isClaudeAvailable without claudeCodeOauthTokenListJsonPath', () => {
    it('should return false when ~/.claude directory does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const repo = new OauthAPIClaudeRepository();
      const result = await repo.isClaudeAvailable(0.9);

      expect(result).toBe(false);
    });

    it('should return false when no credential files found', async () => {
      mockFs.existsSync.mockImplementation((p) => p === claudeDir);
      mockFs.readdirSync.mockReturnValue([]);

      const repo = new OauthAPIClaudeRepository();
      const result = await repo.isClaudeAvailable(0.9);

      expect(result).toBe(false);
    });

    it('should copy best credential file to credentials path when token is under threshold', async () => {
      const credFile = path.join(claudeDir, '.credentials.json.work.1');
      const credContent = JSON.stringify({
        claudeAiOauth: { accessToken: 'valid-token' },
      });

      mockFs.existsSync.mockImplementation((p) => p === claudeDir);
      const readdirMock: jest.SpyInstance = mockFs.readdirSync;
      readdirMock.mockReturnValue(['.credentials.json.work.1']);
      mockFs.readFileSync.mockReturnValue(credContent);

      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ five_hour: { utilization: 0.5 } }), {
          status: 200,
        }),
      );

      const repo = new OauthAPIClaudeRepository();
      const result = await repo.isClaudeAvailable(0.9);

      expect(result).toBe(true);
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        credFile,
        credentialsPath,
      );
    });
  });
});
