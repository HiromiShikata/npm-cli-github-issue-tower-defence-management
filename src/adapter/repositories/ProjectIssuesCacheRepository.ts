import { Issue } from '../../domain/entities/Issue';
import { FieldOption, Project } from '../../domain/entities/Project';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';

export type CachedProjectIssues = {
  lastFetchedAt: string;
  lastFullFetchAt: string;
  project: Project;
  issues: Issue[];
};

export const isProject = (value: unknown): value is Project => {
  if (typeof value !== 'object' || value === null) return false;
  if (!('id' in value) || typeof value.id !== 'string') return false;
  if (!('url' in value) || typeof value.url !== 'string') return false;
  if (!('databaseId' in value) || typeof value.databaseId !== 'number')
    return false;
  if (!('name' in value) || typeof value.name !== 'string') return false;
  if (
    !('status' in value) ||
    typeof value.status !== 'object' ||
    value.status === null
  )
    return false;
  return true;
};

export const isIssueArray = (value: unknown): value is Issue[] =>
  Array.isArray(value) &&
  value.every(
    (item: unknown) =>
      typeof item === 'object' &&
      item !== null &&
      'nameWithOwner' in item &&
      typeof item.nameWithOwner === 'string' &&
      'number' in item &&
      typeof item.number === 'number' &&
      'title' in item &&
      typeof item.title === 'string' &&
      'url' in item &&
      typeof item.url === 'string',
  );

export class ProjectIssuesCacheRepository {
  constructor(
    readonly localStorageCacheRepository: Pick<
      LocalStorageCacheRepository,
      'getSingle' | 'setSingle'
    >,
  ) {}

  cacheKey = (projectId: Project['id']): string => `allIssues-${projectId}`;

  readRaw = async (projectId: Project['id']): Promise<unknown> =>
    this.localStorageCacheRepository.getSingle(this.cacheKey(projectId));

  read = async (
    projectId: Project['id'],
  ): Promise<CachedProjectIssues | null> => {
    const raw = await this.readRaw(projectId);
    if (typeof raw !== 'object' || raw === null) {
      return null;
    }
    if (
      !('lastFetchedAt' in raw) ||
      typeof raw.lastFetchedAt !== 'string' ||
      !('lastFullFetchAt' in raw) ||
      typeof raw.lastFullFetchAt !== 'string' ||
      !('project' in raw) ||
      !('issues' in raw)
    ) {
      return null;
    }
    if (!isProject(raw.project) || !isIssueArray(raw.issues)) {
      return null;
    }
    return {
      lastFetchedAt: raw.lastFetchedAt,
      lastFullFetchAt: raw.lastFullFetchAt,
      project: raw.project,
      issues: raw.issues,
    };
  };

  readProject = async (projectId: Project['id']): Promise<Project | null> => {
    const raw = await this.readRaw(projectId);
    if (typeof raw !== 'object' || raw === null || !('project' in raw)) {
      return null;
    }
    if (!isProject(raw.project)) {
      return null;
    }
    return raw.project;
  };

  write = async (
    projectId: Project['id'],
    cached: CachedProjectIssues,
  ): Promise<void> => {
    await this.localStorageCacheRepository.setSingle(
      this.cacheKey(projectId),
      cached,
    );
  };

  updateFieldOptions = async (
    projectId: Project['id'],
    fieldId: string,
    options: FieldOption[],
  ): Promise<void> => {
    const raw = await this.readRaw(projectId);
    if (typeof raw !== 'object' || raw === null || !('project' in raw)) {
      return;
    }
    if (!isProject(raw.project)) {
      return;
    }
    const project = this.projectWithFieldOptions(raw.project, fieldId, options);
    if (project === null) {
      return;
    }
    await this.localStorageCacheRepository.setSingle(this.cacheKey(projectId), {
      ...raw,
      project,
    });
  };

  private projectWithFieldOptions = (
    project: Project,
    fieldId: string,
    options: FieldOption[],
  ): Project | null => {
    if (project.story !== null && project.story.fieldId === fieldId) {
      return { ...project, story: { ...project.story, stories: options } };
    }
    if (project.status.fieldId === fieldId) {
      return { ...project, status: { ...project.status, statuses: options } };
    }
    return null;
  };
}
