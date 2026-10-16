export type DailySecurityScanRunLogEntry = {
  repositoryName: string;
  executedAtIso: string;
  outcome:
    | { type: 'checkoutFailed'; reason: string }
    | { type: 'scanCompletedClean'; clonedCommitSha: string }
    | {
        type: 'scanCompletedWithVulnerabilities';
        clonedCommitSha: string;
        vulnerablePackageCount: number;
      }
    | {
        type: 'scanFailed';
        clonedCommitSha: string;
        exitCode: number;
        stderr: string;
      };
};
