import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { WorkingTime } from '../../../domain/entities/WorkingTime';

type Issue = {
  url: string;
  title: string;
  status: string;
  assignees: string[];
  labels: string[];
  project: string;
  statusTimeline: IssueStatusTimeline[];
};
type IssueStatusTimeline = {
  time: string;
  author: string;
  from: string;
  to: string;
};
type IssueInProgressTimeline = WorkingTime & {
  issueUrl: string;
};

export class CheerioIssueRepository extends BaseGitHubRepository {
  getIssue = async (issueUrl: string): Promise<Issue> => {
    const headers = await this.createHeader();
    const content = await axios.get<string>(issueUrl, { headers });
    const $ = cheerio.load(content.data);
    const title = this.getTitleFromCheerioObject($);
    const status = this.getStatusFromCheerioObject($);
    const assignees = this.getAssigneesFromCheerioObject($);
    const labels = this.getLabelsFromCheerioObject($);
    const project = this.getProjectFromCheerioObject($);
    const statusTimeline = await this.getStatusTimelineEvents(issueUrl);
    return {
      url: issueUrl,
      title,
      status,
      assignees,
      labels,
      project,
      statusTimeline,
    };
  };
  getStatusTimelineEvents = async (
    issueUrl: string,
  ): Promise<IssueStatusTimeline[]> => {
    const headers = await this.createHeader();
    const content = await axios.get<string>(issueUrl, { headers });
    const $ = cheerio.load(content.data);
    return this.getStatusTimelineEventsFromCheerioObject($);
  };
  protected getTitleFromCheerioObject = ($: cheerio.CheerioAPI): string => {
    return $('h1 > bdi').text();
  };
  protected getStatusFromCheerioObject = ($: cheerio.CheerioAPI): string => {
    return $('sidebar-memex-input > details > summary > span').text();
  };
  protected getAssigneesFromCheerioObject = (
    $: cheerio.CheerioAPI,
  ): string[] => {
    const assignees = $(
      'div.sidebar-assignee > form > span > p > span > a.assignee > span',
    );
    return assignees.map((_, elem) => $(elem).text()).get();
  };
  protected getLabelsFromCheerioObject = ($: cheerio.CheerioAPI): string[] => {
    return $('div.js-issue-labels > a > span')
      .map((_, elem) => $(elem).text())
      .get();
  };
  protected getProjectFromCheerioObject = ($: cheerio.CheerioAPI): string => {
    return $('collapsible-sidebar-widget > div  a > span').text();
  };

  protected getStatusTimelineEventsFromCheerioObject = (
    $: cheerio.CheerioAPI,
  ): IssueStatusTimeline[] => {
    const timelines = $('.TimelineItem-body');
    const res: IssueStatusTimeline[] = [];
    for (const timeline of timelines) {
      const author = $(timeline).find('a.author').text();
      if (!author) {
        continue;
      }
      const time = $(timeline).find('relative-time').attr('datetime');
      if (!time) {
        continue;
      }
      const eventText = $(timeline).find('strong');
      if (eventText.length != 2) {
        continue;
      }
      const from = $(eventText[0]).text();
      const to = $(eventText[1]).text();
      res.push({ time, author, from, to });
    }

    return res;
  };

  getInProgressTimeline = async (issueUrl: string): Promise<WorkingTime[]> => {
    const timelines = await this.getStatusTimelineEvents(issueUrl);

    const report: IssueInProgressTimeline[] = [];
    let currentInProgress:
      | Pick<IssueInProgressTimeline, 'issueUrl' | 'author' | 'startedAt'>
      | undefined = undefined;
    for (const timeline of timelines) {
      const time = new Date(timeline.time);
      if (timeline.to.toLocaleLowerCase().includes('in progress')) {
        if (currentInProgress !== undefined) {
          report.push({
            ...currentInProgress,
            endedAt: time,
            durationMinutes:
              (time.getTime() - currentInProgress.startedAt.getTime()) /
              1000 /
              60,
          });
          currentInProgress = undefined;
        }
        currentInProgress = {
          issueUrl: issueUrl,
          author: timeline.author,
          startedAt: time,
        };
        continue;
      }
      if (currentInProgress != undefined) {
        report.push({
          ...currentInProgress,
          endedAt: time,
          durationMinutes:
            (time.getTime() - currentInProgress.startedAt.getTime()) /
            1000 /
            60,
        });
        currentInProgress = undefined;
      }
    }
    return report;
  };
}