import * as cheerio from 'cheerio';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { WorkingTime } from '../../../domain/entities/WorkingTime';
import { IssueStatusTimeline } from './issueTimelineUtils';
import { InternalGraphqlIssueRepository } from './InternalGraphqlIssueRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
export type Issue = {
    url: string;
    title: string;
    status: string;
    assignees: string[];
    labels: string[];
    project: string;
    statusTimeline: IssueStatusTimeline[];
    inProgressTimeline: WorkingTime[];
    createdAt: Date;
    workingTimeline: WorkingTime[];
};
export declare class CheerioIssueRepository extends BaseGitHubRepository {
    readonly internalGraphqlIssueRepository: InternalGraphqlIssueRepository;
    readonly localStorageRepository: LocalStorageRepository;
    readonly jsonFilePath: string;
    readonly ghToken: string;
    readonly ghUserName: string | undefined;
    readonly ghUserPassword: string | undefined;
    readonly ghAuthenticatorKey: string | undefined;
    constructor(internalGraphqlIssueRepository: InternalGraphqlIssueRepository, localStorageRepository: LocalStorageRepository, jsonFilePath?: string, ghToken?: string, ghUserName?: string | undefined, ghUserPassword?: string | undefined, ghAuthenticatorKey?: string | undefined);
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