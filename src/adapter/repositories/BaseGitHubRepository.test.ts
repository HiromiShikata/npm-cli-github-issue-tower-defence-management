import fs from 'fs';
import axios, { AxiosHeaders, AxiosResponse } from 'axios';
import { getCookieContent } from 'gh-cookie';
import { BaseGitHubRepository } from './BaseGitHubRepository';
import resetAllMocks = jest.resetAllMocks;
import { LocalStorageRepository } from './LocalStorageRepository';

jest.mock('axios');
jest.mock('gh-cookie');

const mockAxios = jest.mocked(axios);
const mockGetCookieContent = jest.mocked(getCookieContent);

const toAxiosResponse = (data: string): AxiosResponse<string> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: new AxiosHeaders() },
});

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
    fs.mkdirSync('./tmp', { recursive: true });
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
    const refreshTestFilePath = './tmp/github.com.refresh-test.cookies.json';
    const ghUserName = 'testuser';
    const oldCookiesJson = JSON.stringify([
      {
        name: 'old_session',
        value: 'old_value',
        domain: 'github.com',
        path: '/',
        expires: 1,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      },
    ]);
    const newCookiesJson = JSON.stringify([
      {
        name: 'new_session',
        value: 'new_value',
        domain: 'github.com',
        path: '/',
        expires: 9999999999,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      },
    ]);

    beforeEach(() => {
      jest.clearAllMocks();
      fs.mkdirSync('./tmp', { recursive: true });
      fs.writeFileSync(refreshTestFilePath, oldCookiesJson);
    });

    afterEach(() => {
      if (fs.existsSync(refreshTestFilePath)) {
        fs.rmSync(refreshTestFilePath);
      }
    });

    it('should throw when credentials are not set', async () => {
      const repo = new BaseGitHubRepository(
        new LocalStorageRepository(),
        refreshTestFilePath,
        'gh_token',
        undefined,
        undefined,
        undefined,
      );

      await expect(repo.refreshCookie()).rejects.toThrow(
        'GitHub username, password, and authenticator key must be set',
      );
    });

    it('should return without error when current cookie is valid', async () => {
      mockAxios.get.mockResolvedValueOnce(
        toAxiosResponse(`<html>${ghUserName} logged in</html>`),
      );

      const repo = new BaseGitHubRepository(
        new LocalStorageRepository(),
        refreshTestFilePath,
        'gh_token',
        ghUserName,
        'password',
        'authkey',
      );

      await expect(repo.refreshCookie()).resolves.toBeUndefined();
      expect(mockGetCookieContent).not.toHaveBeenCalled();
    });

    it('should reset cookie cache and regenerate when current cookie is invalid', async () => {
      mockGetCookieContent.mockResolvedValue(newCookiesJson);
      mockAxios.get
        .mockResolvedValueOnce(toAxiosResponse('<html>no username here</html>'))
        .mockResolvedValueOnce(
          toAxiosResponse(`<html>${ghUserName} logged in</html>`),
        );

      const repo = new BaseGitHubRepository(
        new LocalStorageRepository(),
        refreshTestFilePath,
        'gh_token',
        ghUserName,
        'password',
        'authkey',
      );

      await expect(repo.refreshCookie()).resolves.toBeUndefined();
      expect(mockGetCookieContent).toHaveBeenCalledTimes(1);
    });

    it('should throw Failed to refresh cookie when new cookie is also invalid', async () => {
      mockGetCookieContent.mockResolvedValue(newCookiesJson);
      mockAxios.get.mockResolvedValue(
        toAxiosResponse('<html>no username</html>'),
      );

      const repo = new BaseGitHubRepository(
        new LocalStorageRepository(),
        refreshTestFilePath,
        'gh_token',
        ghUserName,
        'password',
        'authkey',
      );

      await expect(repo.refreshCookie()).rejects.toThrow(
        'Failed to refresh cookie',
      );
    });
  });
});
