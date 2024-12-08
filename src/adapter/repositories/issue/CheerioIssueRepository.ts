import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { WorkingTime } from '../../../domain/entities/WorkingTime';
import {
  getInProgressTimeline,
  IssueStatusTimeline,
} from './issueTimelineUtils';
import { InternalGraphqlIssueRepository } from './InternalGraphqlIssueRepository';

export type Issue = {
  url: string;
  title: string;
  status: string;
  assignees: string[];
  labels: string[];
  project: string;
  statusTimeline: IssueStatusTimeline[];
  inProgressTimeline: WorkingTime[];
};

export class CheerioIssueRepository extends BaseGitHubRepository {
  constructor(
    readonly internalGraphqlIssueRepository: InternalGraphqlIssueRepository,
    readonly jsonFilePath: string = './tmp/github.com.cookies.json',
    readonly ghToken: string = process.env.GH_TOKEN || 'dummy',
  ) {
    super(jsonFilePath, ghToken);
  }
  getIssue = async (issueUrl: string): Promise<Issue> => {
    const headers = await this.createHeader();
    const content = await axios.get<string>(issueUrl, { headers });
    const html = content.data;
    const $ = cheerio.load(html);
    if (html.includes('react-app.embeddedData')) {
      return this.internalGraphqlIssueRepository.getIssueFromBetaFeatureView(
        issueUrl,
        html,
      );
    }
    return this.getIssueFromNormalView(issueUrl, $);
  };
  getIssueFromNormalView = async (
    issueUrl: string,
    $: cheerio.CheerioAPI,
  ): Promise<Issue> => {
    const title = this.getTitleFromCheerioObject($);
    const statusOrig = this.getStatusFromCheerioObject($);
    const assignees = this.getAssigneesFromCheerioObject($);
    const labels = this.getLabelsFromCheerioObject($);
    const project = this.getProjectFromCheerioObject($);
    const statusTimeline = await this.getStatusTimelineEvents($);
    const inProgressTimeline = await getInProgressTimeline(
      statusTimeline,
      issueUrl,
    );
    const status =
      statusOrig !== ''
        ? statusOrig
        : statusTimeline.length > 0
          ? statusTimeline[statusTimeline.length - 1].to
          : '';
    return {
      url: issueUrl,
      title,
      status,
      assignees,
      labels,
      project,
      statusTimeline,
      inProgressTimeline,
    };
  };
  getStatusTimelineEvents = async (
    $: cheerio.CheerioAPI,
  ): Promise<IssueStatusTimeline[]> => {
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
}
