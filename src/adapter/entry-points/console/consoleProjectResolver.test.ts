import { mock } from 'jest-mock-extended';
import { Project } from '../../../domain/entities/Project';
import {
  buildPjcodeToProjectUrl,
  createConsoleProjectResolver,
  createPjcodeConfigChecker,
} from './consoleProjectResolver';

describe('buildPjcodeToProjectUrl', () => {
  it('adds the default pjcode entry when it is not already present', () => {
    const mapping = buildPjcodeToProjectUrl(
      'umino',
      'https://github.com/orgs/umino/projects/1',
      { xmile: 'https://github.com/orgs/xmile/projects/2' },
    );
    expect(mapping).toEqual({
      umino: 'https://github.com/orgs/umino/projects/1',
      xmile: 'https://github.com/orgs/xmile/projects/2',
    });
  });

  it('keeps an explicit default pjcode entry from consoleProjects', () => {
    const mapping = buildPjcodeToProjectUrl(
      'umino',
      'https://github.com/orgs/umino/projects/1',
      { umino: 'https://github.com/orgs/umino/projects/9' },
    );
    expect(mapping.umino).toBe('https://github.com/orgs/umino/projects/9');
  });

  it('uses only the default entry when no consoleProjects mapping is configured', () => {
    const mapping = buildPjcodeToProjectUrl(
      'umino',
      'https://github.com/orgs/umino/projects/1',
      null,
    );
    expect(mapping).toEqual({
      umino: 'https://github.com/orgs/umino/projects/1',
    });
  });
});

describe('createPjcodeConfigChecker', () => {
  it('reports true only for a configured pjcode without loading any project', () => {
    const isConfigured = createPjcodeConfigChecker({
      umino: 'https://github.com/orgs/umino/projects/1',
      xmile: 'https://github.com/orgs/xmile/projects/2',
    });
    expect(isConfigured('umino')).toBe(true);
    expect(isConfigured('xmile')).toBe(true);
    expect(isConfigured('unknown')).toBe(false);
  });
});

describe('createConsoleProjectResolver', () => {
  const uminoProject: Project = { ...mock<Project>(), id: 'PVT_umino' };
  const xmileProject: Project = { ...mock<Project>(), id: 'PVT_xmile' };

  it('resolves a known pjcode to its loaded project', async () => {
    const loadProject = jest.fn(async (url: string) =>
      url.includes('umino') ? uminoProject : xmileProject,
    );
    const resolver = createConsoleProjectResolver(
      {
        umino: 'https://github.com/orgs/umino/projects/1',
        xmile: 'https://github.com/orgs/xmile/projects/2',
      },
      loadProject,
    );
    await expect(resolver('umino')).resolves.toEqual({
      pjcode: 'umino',
      project: uminoProject,
    });
    await expect(resolver('xmile')).resolves.toEqual({
      pjcode: 'xmile',
      project: xmileProject,
    });
  });

  it('returns null for a pjcode that has no configured project url', async () => {
    const loadProject = jest.fn(async () => uminoProject);
    const resolver = createConsoleProjectResolver(
      { umino: 'https://github.com/orgs/umino/projects/1' },
      loadProject,
    );
    await expect(resolver('unknown')).resolves.toBeNull();
    expect(loadProject).not.toHaveBeenCalled();
  });

  it('returns null when the project fails to load', async () => {
    const loadProject = jest.fn(async () => null);
    const resolver = createConsoleProjectResolver(
      { umino: 'https://github.com/orgs/umino/projects/1' },
      loadProject,
    );
    await expect(resolver('umino')).resolves.toBeNull();
  });

  it('loads each project at most once and serves later calls from cache', async () => {
    const loadProject = jest.fn(async () => uminoProject);
    const resolver = createConsoleProjectResolver(
      { umino: 'https://github.com/orgs/umino/projects/1' },
      loadProject,
    );
    await resolver('umino');
    await resolver('umino');
    expect(loadProject).toHaveBeenCalledTimes(1);
  });
});
