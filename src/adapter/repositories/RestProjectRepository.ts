import ky from 'ky';
import { BaseGitHubRepository } from './BaseGitHubRepository';
import {
  ProjectDefinition,
  ProjectFieldDefinition,
  convertToFieldOptionColor,
  projectFromDefinition,
} from './projectFieldDefinition';
import { Project } from '../../domain/entities/Project';

export type ProjectLocation = {
  owner: string;
  ownerType: 'users' | 'orgs';
  projectNumber: number;
};

type RestProjectResponse = {
  id: number;
  node_id: string;
  title: string;
};

type RestProjectFieldResponse = {
  id: number;
  node_id: string;
  name: string;
  options?: {
    id: string;
    name: { raw: string };
    description: { raw: string };
    color: string;
  }[];
};

export const projectUrlFromLocation = (location: ProjectLocation): string =>
  `https://github.com/${location.ownerType}/${location.owner}/projects/${location.projectNumber}`;

export const projectLocationFromUrl = (
  projectUrl: string,
): ProjectLocation | null => {
  const match = projectUrl.match(
    /https:\/\/github\.com\/(users|orgs)\/([^/]+)\/projects\/(\d+)/,
  );
  if (!match) {
    return null;
  }
  const [, ownerType, owner, projectNumberText] = match;
  return {
    owner,
    ownerType: ownerType === 'orgs' ? 'orgs' : 'users',
    projectNumber: parseInt(projectNumberText, 10),
  };
};

export class RestProjectRepository extends BaseGitHubRepository {
  private projectApiUrl = (location: ProjectLocation): string =>
    `https://api.github.com/${location.ownerType}/${location.owner}/projectsV2/${location.projectNumber}`;

  private requestHeaders = (): Record<string, string> => ({
    Authorization: `token ${this.ghToken}`,
    Accept: 'application/vnd.github+json',
  });

  listFieldDefinitions = async (
    location: ProjectLocation,
  ): Promise<ProjectFieldDefinition[]> => {
    const fields = await ky
      .get(`${this.projectApiUrl(location)}/fields`, {
        searchParams: { per_page: 100 },
        headers: this.requestHeaders(),
      })
      .json<RestProjectFieldResponse[]>();
    return fields.map((field) => ({
      fieldId: field.node_id,
      databaseId: field.id,
      name: field.name,
      options: (field.options ?? []).map((option) => ({
        id: option.id,
        name: option.name.raw,
        color: convertToFieldOptionColor(option.color),
        description: option.description.raw,
      })),
    }));
  };

  listFieldNames = async (location: ProjectLocation): Promise<string[]> => {
    const fields = await this.listFieldDefinitions(location);
    return fields.map((field) => field.name);
  };

  getProject = async (location: ProjectLocation): Promise<Project> => {
    const [project, fields] = await Promise.all([
      ky
        .get(this.projectApiUrl(location), { headers: this.requestHeaders() })
        .json<RestProjectResponse>(),
      this.listFieldDefinitions(location),
    ]);
    const definition: ProjectDefinition = {
      id: project.node_id,
      url: projectUrlFromLocation(location),
      databaseId: project.id,
      name: project.title,
      fields,
    };
    return projectFromDefinition(definition);
  };
}
