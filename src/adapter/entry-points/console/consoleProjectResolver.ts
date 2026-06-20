import { Project } from '../../../domain/entities/Project';
import {
  ConsoleProjectBinding,
  ConsoleProjectResolver,
} from './consoleOperationApi';

export type ConsoleProjectLoader = (
  projectUrl: string,
) => Promise<Project | null>;

export const buildPjcodeToProjectUrl = (
  defaultPjcode: string,
  defaultProjectUrl: string,
  consoleProjects: Record<string, string> | null,
): Record<string, string> => {
  const mapping: Record<string, string> = {};
  if (consoleProjects !== null) {
    for (const [pjcode, projectUrl] of Object.entries(consoleProjects)) {
      mapping[pjcode] = projectUrl;
    }
  }
  if (!(defaultPjcode in mapping)) {
    mapping[defaultPjcode] = defaultProjectUrl;
  }
  return mapping;
};

export const createConsoleProjectResolver = (
  pjcodeToProjectUrl: Record<string, string>,
  loadProject: ConsoleProjectLoader,
): ConsoleProjectResolver => {
  const cache = new Map<string, ConsoleProjectBinding>();
  return async (pjcode: string): Promise<ConsoleProjectBinding | null> => {
    const cached = cache.get(pjcode);
    if (cached !== undefined) {
      return cached;
    }
    const projectUrl = pjcodeToProjectUrl[pjcode];
    if (projectUrl === undefined) {
      return null;
    }
    const project = await loadProject(projectUrl);
    if (project === null) {
      return null;
    }
    const binding: ConsoleProjectBinding = { pjcode, project };
    cache.set(pjcode, binding);
    return binding;
  };
};
