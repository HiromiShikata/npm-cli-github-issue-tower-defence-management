import { mock } from 'jest-mock-extended';
import { Project } from '../../../domain/entities/Project';
import {
  buildPjcodeToProjectUrl,
  createConsoleProjectLoader,
  createConsoleProjectResolver,
  createPjcodeConfigChecker,
} from './consoleProjectResolver';

describe('buildPjcodeToProjectUrl', () => {
  it('adds the default pjcode entry when it is not already present', () => {
    const mapping = buildPjcodeToProjectUrl(
      'acme',
      'https://github.com/orgs/acme/projects/1',
      { globex: 'https://github.com/orgs/globex/projects/2' },
    );
    expect(mapping).toEqual({
      acme: 'https://github.com/orgs/acme/projects/1',
      globex: 'https://github.com/orgs/globex/projects/2',
    });
  });

  it('keeps an explicit default pjcode entry from consoleProjects', () => {
    const mapping = buildPjcodeToProjectUrl(
      'acme',
      'https://github.com/orgs/acme/projects/1',
      { acme: 'https://github.com/orgs/acme/projects/9' },
    );
    expect(mapping.acme).toBe('https://github.com/orgs/acme/projects/9');
  });

  it('uses only the default entry when no consoleProjects mapping is configured', () => {
    const mapping = buildPjcodeToProjectUrl(
      'acme',
      'https://github.com/orgs/acme/projects/1',
      null,
    );
    expect(mapping).toEqual({
      acme: 'https://github.com/orgs/acme/projects/1',
    });
  });
});

describe('createPjcodeConfigChecker', () => {
  it('reports true only for a configured pjcode without loading any project', () => {
    const isConfigured = createPjcodeConfigChecker({
      acme: 'https://github.com/orgs/acme/projects/1',
      globex: 'https://github.com/orgs/globex/projects/2',
    });
    expect(isConfigured('acme')).toBe(true);
    expect(isConfigured('globex')).toBe(true);
    expect(isConfigured('unknown')).toBe(false);
  });
});

describe('createConsoleProjectResolver', () => {
  const acmeProject: Project = { ...mock<Project>(), id: 'PVT_acme' };
  const globexProject: Project = { ...mock<Project>(), id: 'PVT_globex' };

  it('resolves a known pjcode to its loaded project', async () => {
    const loadProject = jest.fn(async (url: string) =>
      url.includes('acme') ? acmeProject : globexProject,
    );
    const { resolve } = createConsoleProjectResolver(
      {
        acme: 'https://github.com/orgs/acme/projects/1',
        globex: 'https://github.com/orgs/globex/projects/2',
      },
      loadProject,
    );
    await expect(resolve('acme')).resolves.toEqual({
      pjcode: 'acme',
      project: acmeProject,
    });
    await expect(resolve('globex')).resolves.toEqual({
      pjcode: 'globex',
      project: globexProject,
    });
  });

  it('returns null for a pjcode that has no configured project url', async () => {
    const loadProject = jest.fn(async () => acmeProject);
    const { resolve } = createConsoleProjectResolver(
      { acme: 'https://github.com/orgs/acme/projects/1' },
      loadProject,
    );
    await expect(resolve('unknown')).resolves.toBeNull();
    expect(loadProject).not.toHaveBeenCalled();
  });

  it('returns null when the project fails to load', async () => {
    const loadProject = jest.fn(async () => null);
    const { resolve } = createConsoleProjectResolver(
      { acme: 'https://github.com/orgs/acme/projects/1' },
      loadProject,
    );
    await expect(resolve('acme')).resolves.toBeNull();
  });

  it('loads each project at most once and serves later calls from cache', async () => {
    const loadProject = jest.fn(async () => acmeProject);
    const { resolve } = createConsoleProjectResolver(
      { acme: 'https://github.com/orgs/acme/projects/1' },
      loadProject,
    );
    await resolve('acme');
    await resolve('acme');
    expect(loadProject).toHaveBeenCalledTimes(1);
  });

  it('re-fetches the project after invalidation', async () => {
    const freshProject: Project = { ...mock<Project>(), id: 'PVT_fresh' };
    let callCount = 0;
    const loadProject = jest.fn(async () =>
      callCount++ === 0 ? acmeProject : freshProject,
    );
    const { resolve, invalidate } = createConsoleProjectResolver(
      { acme: 'https://github.com/orgs/acme/projects/1' },
      loadProject,
    );
    await expect(resolve('acme')).resolves.toMatchObject({
      project: acmeProject,
    });
    invalidate('acme');
    await expect(resolve('acme')).resolves.toMatchObject({
      project: freshProject,
    });
    expect(loadProject).toHaveBeenCalledTimes(2);
  });

  it('updateEntry replaces the cached project so the next resolve returns the updated project', async () => {
    const updatedProject: Project = { ...acmeProject, id: 'PVT_acme_updated' };
    const loadProject = jest.fn(async () => acmeProject);
    const { resolve, updateEntry } = createConsoleProjectResolver(
      { acme: 'https://github.com/orgs/acme/projects/1' },
      loadProject,
    );
    await resolve('acme');
    updateEntry('acme', updatedProject);
    const result = await resolve('acme');
    expect(result?.project).toBe(updatedProject);
    expect(loadProject).toHaveBeenCalledTimes(1);
  });

  it('updateEntry is a no-op for a pjcode that was never resolved', async () => {
    const updatedProject: Project = { ...acmeProject, id: 'PVT_acme_updated' };
    const loadProject = jest.fn(async () => acmeProject);
    const { resolve, updateEntry } = createConsoleProjectResolver(
      { acme: 'https://github.com/orgs/acme/projects/1' },
      loadProject,
    );
    updateEntry('acme', updatedProject);
    const result = await resolve('acme');
    expect(result?.project).toBe(acmeProject);
  });
});

describe('createConsoleProjectLoader', () => {
  const globexProjectOfLoader: Project = {
    ...mock<Project>(),
    id: 'PVT_globex',
  };

  const buildProjectRepositoryResolver = (
    findProjectIdByUrl: (projectUrl: string) => Promise<string | null>,
    getProject: (projectId: string) => Promise<Project | null>,
  ) =>
    jest.fn((projectUrl: string) => {
      if (projectUrl !== 'https://github.com/orgs/globex/projects/18') {
        throw new Error(`unexpected project url: ${projectUrl}`);
      }
      return { findProjectIdByUrl, getProject };
    });

  it('resolves the project id through the repository chosen for the project url', async () => {
    const resolveProjectRepository = buildProjectRepositoryResolver(
      async () => 'PVT_globex',
      async () => globexProjectOfLoader,
    );
    const loadProject = createConsoleProjectLoader(
      resolveProjectRepository,
      async () => null,
      () => undefined,
    );

    await expect(
      loadProject('https://github.com/orgs/globex/projects/18'),
    ).resolves.toBe(globexProjectOfLoader);
    expect(resolveProjectRepository).toHaveBeenCalledWith(
      'https://github.com/orgs/globex/projects/18',
    );
  });

  it('prefers the locally cached project over a GraphQL project load', async () => {
    const getProject = jest.fn(async () => globexProjectOfLoader);
    const loadProject = createConsoleProjectLoader(
      buildProjectRepositoryResolver(async () => 'PVT_globex', getProject),
      async (projectId: string) =>
        projectId === 'PVT_globex' ? globexProjectOfLoader : null,
      () => undefined,
    );

    await expect(
      loadProject('https://github.com/orgs/globex/projects/18'),
    ).resolves.toBe(globexProjectOfLoader);
    expect(getProject).not.toHaveBeenCalled();
  });

  it('reports and returns null when the project id cannot be resolved', async () => {
    const reportedMessages: string[] = [];
    const loadProject = createConsoleProjectLoader(
      buildProjectRepositoryResolver(
        async () => null,
        async () => globexProjectOfLoader,
      ),
      async () => null,
      (message: string) => reportedMessages.push(message),
    );

    await expect(
      loadProject('https://github.com/orgs/globex/projects/18'),
    ).resolves.toBeNull();
    expect(reportedMessages).toEqual([
      'No project found for projectUrl https://github.com/orgs/globex/projects/18',
    ]);
  });

  it('reports and returns null when the project cannot be loaded', async () => {
    const reportedMessages: string[] = [];
    const loadProject = createConsoleProjectLoader(
      buildProjectRepositoryResolver(
        async () => 'PVT_globex',
        async () => null,
      ),
      async () => null,
      (message: string) => reportedMessages.push(message),
    );

    await expect(
      loadProject('https://github.com/orgs/globex/projects/18'),
    ).resolves.toBeNull();
    expect(reportedMessages).toEqual([
      'Failed to load project for projectUrl https://github.com/orgs/globex/projects/18',
    ]);
  });
});
