import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  FileSystemAgentHeartbeatRepository,
  toHeartbeatFileName,
} from './FileSystemAgentHeartbeatRepository';

describe('FileSystemAgentHeartbeatRepository', () => {
  let tmpDir: string;
  let repository: FileSystemAgentHeartbeatRepository;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heartbeat-test-'));
    repository = new FileSystemAgentHeartbeatRepository(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('toHeartbeatFileName', () => {
    it('strips the https scheme and replaces non-alphanumeric characters', () => {
      expect(
        toHeartbeatFileName('https://github.com/user/repo/issues/42'),
      ).toBe('github-com-user-repo-issues-42');
    });

    it('strips the http scheme', () => {
      expect(toHeartbeatFileName('http://github.com/user/repo/issues/1')).toBe(
        'github-com-user-repo-issues-1',
      );
    });
  });

  describe('writeHeartbeat', () => {
    it('creates the heartbeat file with the epoch seconds', async () => {
      const issueUrl = 'https://github.com/user/repo/issues/1';
      await repository.writeHeartbeat(issueUrl, 1700000000);

      const filePath = path.join(tmpDir, toHeartbeatFileName(issueUrl));
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toBe('1700000000');
    });

    it('overwrites an existing heartbeat file', async () => {
      const issueUrl = 'https://github.com/user/repo/issues/2';
      await repository.writeHeartbeat(issueUrl, 1700000000);
      await repository.writeHeartbeat(issueUrl, 1700000999);

      const filePath = path.join(tmpDir, toHeartbeatFileName(issueUrl));
      expect(fs.readFileSync(filePath, 'utf8')).toBe('1700000999');
    });

    it('creates the heartbeat directory when it does not exist', async () => {
      const nestedDir = path.join(tmpDir, 'sub', 'nested');
      const repo = new FileSystemAgentHeartbeatRepository(nestedDir);
      const issueUrl = 'https://github.com/user/repo/issues/3';

      await repo.writeHeartbeat(issueUrl, 1700000000);

      expect(fs.existsSync(nestedDir)).toBe(true);
    });
  });

  describe('readHeartbeatEpochSeconds', () => {
    it('returns the stored epoch seconds', async () => {
      const issueUrl = 'https://github.com/user/repo/issues/10';
      await repository.writeHeartbeat(issueUrl, 1700000000);

      const result = await repository.readHeartbeatEpochSeconds(issueUrl);
      expect(result).toBe(1700000000);
    });

    it('returns null when no heartbeat file exists', async () => {
      const result = await repository.readHeartbeatEpochSeconds(
        'https://github.com/user/repo/issues/99',
      );
      expect(result).toBeNull();
    });

    it('returns null when the file contains non-numeric content', async () => {
      const issueUrl = 'https://github.com/user/repo/issues/11';
      const filePath = path.join(tmpDir, toHeartbeatFileName(issueUrl));
      fs.writeFileSync(filePath, 'not-a-number', 'utf8');

      const result = await repository.readHeartbeatEpochSeconds(issueUrl);
      expect(result).toBeNull();
    });
  });
});
