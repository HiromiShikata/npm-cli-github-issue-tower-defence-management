import axios from 'axios';
import { BaseGitHubRepository } from './BaseGitHubRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { FieldOption, Project } from '../../domain/entities/Project';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';

export class CheerioProjectRepository
  extends BaseGitHubRepository
  implements Pick<ProjectRepository, 'updateStoryList'>
{
  constructor(
    readonly localStorageRepository: LocalStorageRepository,
    readonly jsonFilePath: string = './tmp/github.com.cookies.json',
    readonly ghToken: string = process.env.GH_TOKEN || 'dummy',
    readonly ghUserName: string | undefined = process.env.GH_USER_NAME,
    readonly ghUserPassword: string | undefined = process.env.GH_USER_PASSWORD,
    readonly ghAuthenticatorKey: string | undefined = process.env
      .GH_AUTHENTICATOR_KEY,
  ) {
    super(
      localStorageRepository,
      jsonFilePath,
      ghToken,
      ghUserName,
      ghUserPassword,
      ghAuthenticatorKey,
    );
  }
  updateStoryList = async (
    project: Project,
    newStoryList: (Omit<FieldOption, 'id'> & {
      id: FieldOption['id'] | null;
    })[],
  ): Promise<FieldOption[]> => {
    const headers = await this.createHeader();
    const res = await axios.put<{
      memexProjectColumn: {
        id: string;
        settings: {
          width: number;
          options: FieldOption[];
        };
      };
    }>(
      `https://github.com/memexes/${project.databaseId}/columns`,
      {
        memexProjectColumnId: project.story?.databaseId,
        settings: {
          width: 200,
          options: newStoryList,
        },
      },
      {
        headers: {
          'github-verified-fetch': 'true',
          origin: 'https://github.com',
          'x-requested-with': 'XMLHttpRequest',
          ...headers,
        },
      },
    );
    return res.data.memexProjectColumn.settings.options.map((v) => ({
      id: v.id,
      name: v.name,
      color: v.color,
      description: v.description,
    }));
  };
}
