import fs from 'fs';
import path from 'path';
import type { Issue } from '../../../domain/entities/Issue';
import type { Project } from '../../../domain/entities/Project';
import {
  GenerateInTmuxByHumanDataUseCase,
  InTmuxByHumanData,
} from '../../../domain/usecases/intmux/GenerateInTmuxByHumanDataUseCase';

export type InTmuxByHumanDataWriterParams = {
  inTmuxDataOutputDir: string | null | undefined;
  inTmuxConsoleBaseUrl: string | null | undefined;
  inTmuxConsoleToken: string | null | undefined;
  inTmuxProjectOrder: string[] | null | undefined;
  pjcode: string | null | undefined;
  assigneeLogin: string | null | undefined;
  org: string;
  repo: string;
  newIssueRepo?: string | null | undefined;
  project: Project;
  issues: Issue[];
  now: Date;
};

const writeJsonAtomic = (filePath: string, data: unknown): void => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tmpPath, filePath);
};

export const writeInTmuxByHumanData = (
  params: InTmuxByHumanDataWriterParams,
): void => {
  const {
    inTmuxDataOutputDir,
    inTmuxConsoleBaseUrl,
    inTmuxConsoleToken,
    inTmuxProjectOrder,
    pjcode,
    assigneeLogin,
    org,
    repo,
    newIssueRepo,
    project,
    issues,
    now,
  } = params;
  if (!inTmuxDataOutputDir || !pjcode || !assigneeLogin) {
    return;
  }

  const data: InTmuxByHumanData = new GenerateInTmuxByHumanDataUseCase().run({
    project,
    issues,
    pjcode,
    assigneeLogin,
    org,
    repo,
    newIssueRepo: newIssueRepo ?? undefined,
    consoleBaseUrl: inTmuxConsoleBaseUrl ?? null,
    consoleToken: inTmuxConsoleToken ?? null,
    now,
  });

  writeJsonAtomic(path.join(inTmuxDataOutputDir, `${pjcode}.json`), data.v1);
  writeJsonAtomic(path.join(inTmuxDataOutputDir, `${pjcode}.v2.json`), data.v2);
  if (data.v3) {
    writeJsonAtomic(
      path.join(inTmuxDataOutputDir, `${pjcode}.v3.json`),
      data.v3,
    );
  }
  if (data.v4) {
    writeJsonAtomic(
      path.join(inTmuxDataOutputDir, `${pjcode}.v4.json`),
      data.v4,
    );
  }

  if (!inTmuxProjectOrder || inTmuxProjectOrder.length === 0) {
    return;
  }
  const presentProjects = inTmuxProjectOrder.filter((name) =>
    fs.existsSync(path.join(inTmuxDataOutputDir, `${name}.json`)),
  );
  writeJsonAtomic(path.join(inTmuxDataOutputDir, 'index.json'), {
    projects: presentProjects,
  });
  writeJsonAtomic(path.join(inTmuxDataOutputDir, 'index.v2.json'), {
    version: 2,
    projects: presentProjects,
  });
  writeJsonAtomic(path.join(inTmuxDataOutputDir, 'index.v3.json'), {
    version: 3,
    projects: presentProjects,
  });
  if (inTmuxConsoleToken) {
    const outputDirBasename = path.basename(inTmuxDataOutputDir);
    writeJsonAtomic(path.join(inTmuxDataOutputDir, 'index.v4.json'), {
      version: 4,
      projects: presentProjects.map((name) => ({
        name,
        path: `/${outputDirBasename}/${name}.v4.json?k=${inTmuxConsoleToken}`,
      })),
    });
  }
};
