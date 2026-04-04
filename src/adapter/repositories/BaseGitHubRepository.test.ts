const mockKyGetText = jest.fn<Promise<string>, []>();
const mockKyGet = jest.fn(() => ({ text: mockKyGetText }));

jest.mock('ky', () => ({
  default: {
    get: mockKyGet,
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    extend: jest.fn(),
    create: jest.fn(),
    stop: jest.fn(),
  },
  __esModule: true,
}));

import fs from 'fs';
import { BaseGitHubRepository } from './BaseGitHubRepository';
import resetAllMocks = jest.resetAllMocks;
import { LocalStorageRepository } from './LocalStorageRepository';

const mockGetCookieContent = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('gh-cookie', () => ({
  getCookieContent: (...args: unknown[]): Promise<unknown> =>
    mockGetCookieContent(...args),
}));
describe('BaseGitHubRepository', () => {
  const jsonFilePath = './tmp/github.com.cookies.json';
  const localStorageRepository = new LocalStorageRepository();
  class TestGitHubRepository extends BaseGitHubRepository {
    constructor() {
      super(localStorageRepository, jsonFilePath, process.env.GH_TOKEN);
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

  describe('refreshCookie', () => {
    const localStorageRepositoryForRefresh = new LocalStorageRepository();
    const refreshCookieJsonFilePath =
      './tmp/refresh-test-github.com.cookies.json';
    const ghUserName = 'testuser';
    class RefreshTestRepository extends BaseGitHubRepository {
      constructor() {
        super(
          localStorageRepositoryForRefresh,
          refreshCookieJsonFilePath,
          'dummy-token',
          ghUserName,
          'dummy-password',
          'dummy-authenticator-key',
        );
      }
    }

    const validCookieJson = JSON.stringify([
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
    ]);

    beforeEach(() => {
      mockKyGet.mockReset().mockReturnValue({ text: mockKyGetText });
      mockKyGetText.mockReset();
      mockGetCookieContent.mockReset();
      mockGetCookieContent.mockResolvedValue(validCookieJson);
      fs.writeFileSync(refreshCookieJsonFilePath, validCookieJson);
    });

    afterEach(() => {
      if (fs.existsSync(refreshCookieJsonFilePath)) {
        fs.rmSync(refreshCookieJsonFilePath);
      }
    });

    it('should return when HTML contains user-login meta tag for current user (logged in)', async () => {
      const repository = new RefreshTestRepository();
      mockKyGetText.mockResolvedValueOnce(
        `<html><head><meta name="user-login" content="${ghUserName}"></head><body><h1>${ghUserName}</h1></body></html>`,
      );

      await expect(repository.refreshCookie()).resolves.toBeUndefined();

      expect(mockKyGet).toHaveBeenCalledWith(
        `https://github.com/${ghUserName}`,
        expect.anything(),
      );
      expect(mockKyGet).toHaveBeenCalledTimes(1);
    });

    it('should fail when HTML contains username in content but not in user-login meta tag (not logged in)', async () => {
      const repository = new RefreshTestRepository();
      const notLoggedInHtml = `<html><head><meta name="user-login" content=""></head><body><h1>${ghUserName}</h1><p>Public profile</p></body></html>`;
      mockKyGetText
        .mockResolvedValueOnce(notLoggedInHtml)
        .mockResolvedValueOnce(notLoggedInHtml);

      await expect(repository.refreshCookie()).rejects.toThrow(
        'Failed to refresh cookie',
      );
    });

    it('should use profile page URL not homepage to check authentication', async () => {
      const repository = new RefreshTestRepository();
      mockKyGetText.mockResolvedValueOnce(
        `<html><head><meta name="user-login" content="${ghUserName}"></head><body></body></html>`,
      );

      await repository.refreshCookie();

      expect(mockKyGet).toHaveBeenCalledWith(
        `https://github.com/${ghUserName}`,
        expect.anything(),
      );
      expect(mockKyGet).not.toHaveBeenCalledWith(
        'https://github.com',
        expect.anything(),
      );
    });

    it('should throw when both profile page checks fail', async () => {
      const repository = new RefreshTestRepository();
      const notLoggedInHtml = `<html><head><meta name="user-login" content=""></head><body></body></html>`;
      mockKyGetText
        .mockResolvedValueOnce(notLoggedInHtml)
        .mockResolvedValueOnce(notLoggedInHtml);

      await expect(repository.refreshCookie()).rejects.toThrow(
        'Failed to refresh cookie',
      );
    });

    it('should reset cookie cache before regenerating so new cookie is used', async () => {
      const repository = new RefreshTestRepository();
      mockKyGetText
        .mockResolvedValueOnce(
          `<html><head><meta name="user-login" content=""></head><body></body></html>`,
        )
        .mockResolvedValueOnce(
          `<html><head><meta name="user-login" content="${ghUserName}"></head><body></body></html>`,
        );

      await expect(repository.refreshCookie()).resolves.toBeUndefined();
      expect(mockKyGet).toHaveBeenCalledTimes(2);
      expect(mockGetCookieContent).toHaveBeenCalledTimes(1);
    });
  });
});
