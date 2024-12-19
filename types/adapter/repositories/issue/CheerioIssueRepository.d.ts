import * as cheerio from 'cheerio';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { WorkingTime } from '../../../domain/entities/WorkingTime';
import { IssueStatusTimeline } from './issueTimelineUtils';
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
export declare class CheerioIssueRepository extends BaseGitHubRepository {
    readonly internalGraphqlIssueRepository: InternalGraphqlIssueRepository;
    readonly jsonFilePath: string;
    readonly ghToken: string;
    constructor(internalGraphqlIssueRepository: InternalGraphqlIssueRepository, jsonFilePath?: string, ghToken?: string);
    getIssue: (issueUrl: string) => Promise<Issue>;
    getIssueFromNormalView: (issueUrl: string, $: cheerio.CheerioAPI) => Promise<Issue>;
    getStatusTimelineEvents: ($: cheerio.CheerioAPI) => Promise<IssueStatusTimeline[]>;
    protected getTitleFromCheerioObject: ($: cheerio.CheerioAPI) => string;
    protected getStatusFromCheerioObject: ($: cheerio.CheerioAPI) => string;
    protected getAssigneesFromCheerioObject: ($: cheerio.CheerioAPI) => string[];
    protected getLabelsFromCheerioObject: ($: cheerio.CheerioAPI) => string[];
    protected getProjectFromCheerioObject: ($: cheerio.CheerioAPI) => string;
    protected getStatusTimelineEventsFromCheerioObject: ($: cheerio.CheerioAPI) => IssueStatusTimeline[];
}
//# sourceMappingURL=CheerioIssueRepository.d.ts.map