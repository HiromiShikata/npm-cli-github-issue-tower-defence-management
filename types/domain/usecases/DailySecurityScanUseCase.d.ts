import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { HttpRepository } from './adapter-interfaces/HttpRepository';
import { KevReportWatermarkRepository } from './adapter-interfaces/KevReportWatermarkRepository';
import { Member } from '../entities/Member';
export type DailySecurityScanConfig = {
    scanBaseDirectory: string;
    targetHourUtc: number;
    enableKevNvdReport?: boolean;
    kevReportRepo?: string;
};
export declare class DailySecurityScanUseCase {
    readonly localCommandRunner: LocalCommandRunner;
    readonly issueRepository: Pick<IssueRepository, 'createNewIssue' | 'searchIssue' | 'createCommentByUrl'>;
    readonly httpRepository: HttpRepository;
    readonly kevReportWatermarkRepository: KevReportWatermarkRepository;
    constructor(localCommandRunner: LocalCommandRunner, issueRepository: Pick<IssueRepository, 'createNewIssue' | 'searchIssue' | 'createCommentByUrl'>, httpRepository: HttpRepository, kevReportWatermarkRepository: KevReportWatermarkRepository);
    run: (input: {
        targetDates: Date[];
        org: string;
        manager: Member["name"];
        dailySecurityScan: DailySecurityScanConfig;
    }) => Promise<void>;
    private scanRepositories;
    private checkoutDefaultBranch;
    private reportKevAdditions;
}
//# sourceMappingURL=DailySecurityScanUseCase.d.ts.map