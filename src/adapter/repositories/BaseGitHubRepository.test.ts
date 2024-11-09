import fs from 'fs';
import { BaseGitHubRepository } from './BaseGitHubRepository';
import resetAllMocks = jest.resetAllMocks;
describe('BaseGitHubRepository', () => {
  const jsonFilePath = './tmp/temporary.test.github.com.cookies.json';
  class TestGitHubRepository extends BaseGitHubRepository {
    constructor() {
      super(jsonFilePath, process.env.TEST_BOT_GH_TOKEN);
    }
    extractIssueFromUrlPublic = this.extractIssueFromUrl;
    createHeaderPublic = this.createHeader;
    createCookieStringFromFilePublic = this.createCookieStringFromFile;
    isCookiePublic = this.isCookie;
  }
  const baseGitHubRepository: TestGitHubRepository = new TestGitHubRepository();
  beforeAll(() => {
    resetAllMocks();
    const cookies = [
      {
        name: 'name',
        value: 'value',
        domain: 'domain',
        path: 'path',
        expires: 1,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ];
    fs.writeFileSync(jsonFilePath, JSON.stringify(cookies));
  });
  afterAll(() => {
    fs.rmSync(jsonFilePath);
  });

  describe('extractIssueFromUrl', () => {
    it('should return issue number', () => {
      const extracted = baseGitHubRepository.extractIssueFromUrlPublic(
        'https://github.com/HiromiShikata/test-repository/issues/38',
      );
      expect(extracted).toEqual({
        owner: 'HiromiShikata',
        repo: 'test-repository',
        issueNumber: 38,
        isIssue: true,
      });
    });
  });

  describe('createHeader', () => {
    it('should return headers with cookie', async () => {
      const headers = await baseGitHubRepository.createHeaderPublic();
      expect(headers).toHaveProperty('cookie');
    });
  });

  describe('createCookieStringFromFile', () => {
    it('should return cookie string', async () => {
      const cookie =
        await baseGitHubRepository.createCookieStringFromFilePublic();
      expect(cookie).toEqual(
        'name=value; Domain=domain; Path=path; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly; Secure; SameSite=Lax',
      );
    });
  });

  describe('isCookie', () => {
    it('should return true if cookie is valid', () => {
      const cookie = {
        name: 'name',
        value: 'value',
        domain: 'domain',
        path: 'path',
        expires: 1,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      };
      expect(baseGitHubRepository.isCookiePublic(cookie)).toBe(true);
    });

    it('should return false if cookie is invalid', () => {
      const cookie = {
        name: 'name',
        value: 'value',
        domain: 'domain',
        path: 'path',
        expires: 1,
        httpOnly: true,
        secure: true,
      };
      expect(baseGitHubRepository.isCookiePublic(cookie)).toBe(false);
    });
  });
});
