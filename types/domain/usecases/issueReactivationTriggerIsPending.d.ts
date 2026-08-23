import { Issue } from '../entities/Issue';
export declare const issueReactivationTriggerStartOfTomorrow: (evaluatedAt: Date) => Date;
export declare const issueReactivationTriggerIsPending: (issue: Pick<Issue, "nextActionDate" | "nextActionHour">, evaluatedAt: Date) => boolean;
//# sourceMappingURL=issueReactivationTriggerIsPending.d.ts.map