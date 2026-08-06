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
    const resolver = createConsoleProjectResolver(
      {
        acme: 'https://github.com/orgs/acme/projects/1',
        globex: 'https://github.com/orgs/globex/projects/2',
      },
      loadProject,
    );
    await expect(resolver('acme')).resolves.toEqual({
      pjcode: 'acme',
      project: acmeProject,
    });
    await expect(resolver('globex')).resolves.toEqual({
      pjcode: 'globex',
      project: globexProject,
    });
  });

  it('returns null for a pjcode that has no configured project url', async () => {
    const loadProject = jest.fn(async () => acmeProject);
    const resolver = createConsoleProjectResolver(
      { acme: 'https://github.com/orgs/acme/projects/1' },
      loadProject,
    );
    await expect(resolver('unknown')).resolves.toBeNull();
    expect(loadProject).not.toHaveBeenCalled();
  });

  it('returns null when the project fails to load', async () => {
    const loadProject = jest.fn(async () => null);
    const resolver = createConsoleProjectResolver(
      { acme: 'https://github.com/orgs/acme/projects/1' },
      loadProject,
    );
    await expect(resolver('acme')).resolves.toBeNull();
  });

  it('loads each project at most once and serves later calls from cache', async () => {
    const loadProject = jest.fn(async () => acmeProject);
    const resolver = createConsoleProjectResolver(
      { acme: 'https://github.com/orgs/acme/projects/1' },
      loadProject,
    );
    await resolver('acme');
    await resolver('acme');
    expect(loadProject).toHaveBeenCalledTimes(1);
  });
});
