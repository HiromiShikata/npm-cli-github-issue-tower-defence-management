import { BrowserGitHubProjectRepository } from './BrowserGitHubProjectRepository';
import { Project } from '../../domain/entities/Project';

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

const buildProject = (url: string): Project => ({
  id: 'project-1',
  url,
  databaseId: 1,
  name: 'test-project',
  status: {
    name: 'Status',
    fieldId: 'status-field-1',
    statuses: [
      { id: 'opt-aw', name: 'Awaiting Workspace', color: 'BLUE', description: '' },
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

describe('BrowserGitHubProjectRepository', () => {
  it('should call console.warn and return without throwing when username is undefined', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const repo = new BrowserGitHubProjectRepository(
      undefined,
      'password',
      undefined,
    );
    const project = buildProject('https://github.com/users/testuser/projects/1');

    await expect(
      repo.setStatusFieldDefault(project, 'opt-aw'),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GITHUB_USERNAME or GITHUB_PASSWORD is unset'),
    );
    warnSpy.mockRestore();
  });

  it('should call console.warn and return without throwing when password is undefined', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const repo = new BrowserGitHubProjectRepository(
      'username',
      undefined,
      undefined,
    );
    const project = buildProject('https://github.com/users/testuser/projects/1');

    await expect(
      repo.setStatusFieldDefault(project, 'opt-aw'),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GITHUB_USERNAME or GITHUB_PASSWORD is unset'),
    );
    warnSpy.mockRestore();
  });

  it('should throw when projectLocationFromUrl returns null for an invalid URL', async () => {
    const repo = new BrowserGitHubProjectRepository(
      'username',
      'password',
      undefined,
    );
    const project = buildProject('https://example.com/invalid/url');

    await expect(
      repo.setStatusFieldDefault(project, 'opt-aw'),
    ).rejects.toThrow('cannot parse project URL');
  });
});
