import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { HttpRepository } from './adapter-interfaces/HttpRepository';
import { Member } from '../entities/Member';
export type DailySecurityScanConfig = {
    scanBaseDirectory: string;
    targetHourUtc: number;
    enableKevNvdReport?: boolean;
    kevReportRepo?: string;
};
export declare class DailySecurityScanUseCase {
    readonly localCommandRunner: LocalCommandRunner;
    readonly issueRepository: Pick<IssueRepository, 'createNewIssue'>;
    readonly httpRepository: HttpRepository;
    constructor(localCommandRunner: LocalCommandRunner, issueRepository: Pick<IssueRepository, 'createNewIssue'>, httpRepository: HttpRepository);
    run: (input: {
        targetDates: Date[];
        org: string;
        manager: Member["name"];
        dailySecurityScan: DailySecurityScanConfig;
    }) => Promise<void>;
    private scanRepositories;
    private reportKevAdditions;
}
//# sourceMappingURL=DailySecurityScanUseCase.d.ts.map