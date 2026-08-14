import { Issue } from '../../../domain/entities/Issue';
import { toTmuxSessionName } from '../../../domain/usecases/intmux/InTmuxByHumanSessionReconcileUseCase';
import { ownerCallFileDelete } from './ownerCallFileStore';

export type CleanClosedIssueOwnerCallFilesParams = {
  inTmuxDataOutputDir: string | null | undefined;
  pjcode: string | null | undefined;
  issues: Issue[];
};

export const cleanClosedIssueOwnerCallFiles = (
  params: CleanClosedIssueOwnerCallFilesParams,
): void => {
  const { inTmuxDataOutputDir, pjcode, issues } = params;
  if (!inTmuxDataOutputDir || !pjcode) {
    return;
  }
  for (const issue of issues.filter((candidate) => candidate.isClosed)) {
    ownerCallFileDelete({
      dataDir: inTmuxDataOutputDir,
      projectCode: pjcode,
      sessionName: toTmuxSessionName(issue.url),
    });
  }
};
