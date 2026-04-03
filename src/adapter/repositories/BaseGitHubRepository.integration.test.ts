import fs from 'fs';
import { BaseGitHubRepository } from './BaseGitHubRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import dotenv from 'dotenv';

dotenv.config();

describe('BaseGitHubRepository', () => {
  jest.setTimeout(60 * 1000);

  const integrationCookiePath =
    './tmp/github.com.integration-refresh.cookies.json';

  const fakeCookiesJson = JSON.stringify([
    {
      name: 'fake_session',
      value: 'invalid_value',
      domain: 'github.com',
      path: '/',
      expires: 9999999999,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    },
  ]);

  beforeEach(() => {
    fs.mkdirSync('./tmp', { recursive: true });
    fs.writeFileSync(integrationCookiePath, fakeCookiesJson);
  });

  afterEach(() => {
    if (fs.existsSync(integrationCookiePath)) {
      fs.rmSync(integrationCookiePath);
    }
  });

  describe('refreshCookie', () => {
    it('should regenerate cookie and succeed when existing cookie is rejected by GitHub', async () => {
      const repo = new BaseGitHubRepository(
        new LocalStorageRepository(),
        integrationCookiePath,
      );
      await expect(repo.refreshCookie()).resolves.toBeUndefined();
    });
  });
});
