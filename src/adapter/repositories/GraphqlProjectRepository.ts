import axios from 'axios';
import { BaseGitHubRepository } from './BaseGitHubRepository';

export class GraphqlProjectRepository extends BaseGitHubRepository {
  fetchProjectId = async (
    login: string,
    projectNumber: number,
  ): Promise<string> => {
    const graphqlQuery = {
      query: `query GetProjectID($login: String!, $number: Int!) {
  organization(login: $login) {
    projectV2(number: $number) {
      id
    }
  }
  user(login: $login){
    projectV2(number: $number){
      id
    }
  }
}`,
      variables: {
        login: login,
        number: projectNumber,
      },
    };

    const response = await axios<{
      data: {
        organization: {
          projectV2: {
            id: string;
          };
        };
        user: {
          projectV2: {
            id: string;
          };
        };
      };
    }>({
      url: 'https://api.github.com/graphql',
      method: 'post',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(graphqlQuery),
    });

    const projectId =
      response.data.data.organization?.projectV2?.id ||
      response.data.data.user?.projectV2?.id;
    if (!projectId) {
      throw new Error('projectId is not found');
    }
    return projectId;
  };
}
