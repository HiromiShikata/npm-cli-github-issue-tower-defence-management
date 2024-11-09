import dotenv from 'dotenv';
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { GraphqlProjectItemRepository } from '../../repositories/GraphqlProjectItemRepository';
import { CheerioIssueRepository } from '../../repositories/CheerioIssueRepository';
import { TimelineEvent } from '../../../domain/entities/TimelineEvent';
import { Issue } from '../../../domain/entities/Issue';

dotenv.config();

export class GithubRepository {
  graphqlProjectRepository: GraphqlProjectRepository;
  graphqlProjectItemRepository: GraphqlProjectItemRepository;
  cheerioIssueRepository: CheerioIssueRepository;
  constructor(
    readonly jsonFilePath: string = './tmp/github.com.cookies.json',
    readonly ghToken: string = process.env.GH_TOKEN || 'dummy',
  ) {
    this.graphqlProjectRepository = new GraphqlProjectRepository(
      jsonFilePath,
      ghToken,
    );
    this.graphqlProjectItemRepository = new GraphqlProjectItemRepository(
      jsonFilePath,
      ghToken,
    );
    this.cheerioIssueRepository = new CheerioIssueRepository(
      jsonFilePath,
      ghToken,
    );
  }
  convertIsoToHhmm = (isoString: string): string => {
    const date = new Date(isoString);
    const hh = date.getHours();
    const mm = date.getMinutes();
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  calculateDuration = (
    startIsoString: string,
    endIsoString: string,
  ): string => {
    const startDate = new Date(startIsoString);
    const endDate = new Date(endIsoString);
    startDate.setMilliseconds(0);
    startDate.setSeconds(0);
    endDate.setMilliseconds(0);
    endDate.setSeconds(0);
    const duration = endDate.getTime() - startDate.getTime();
    const hh = Math.floor(duration / (1000 * 60 * 60));
    const mm = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  calculateTotalHhmm = (timelineEvents: TimelineEvent[]): string => {
    const totalDuration = timelineEvents.reduce((acc, event) => {
      const [hh, mm] = event.durationHhmm.split(':').map(Number);
      return acc + hh * 60 + mm;
    }, 0);
    const totalHh = Math.floor(totalDuration / 60);
    const totalMm = totalDuration % 60;
    return `${String(totalHh).padStart(2, '0')}:${String(totalMm).padStart(2, '0')}`;
  };

  getProjectIssues = async (
    org: string,
    projectNumber: number,
  ): Promise<Issue[]> => {
    const projectId = await this.graphqlProjectRepository.fetchProjectId(
      org,
      projectNumber,
    );
    const items =
      await this.graphqlProjectItemRepository.fetchProjectItems(projectId);
    const issues = await Promise.all(
      items.map(async (item) => {
        const timeline =
          await this.cheerioIssueRepository.getInProgressTimeline(item.url);
        return {
          ...item,
          timeline,
        };
      }),
    );
    return issues;
  };
}
