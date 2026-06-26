import fs from 'fs';
import path from 'path';
import type { Issue } from '../../../domain/entities/Issue';
import {
  DashboardRow,
  GenerateDashboardRowUseCase,
} from '../../../domain/usecases/dashboard/GenerateDashboardRowUseCase';

export type DashboardRowWriterParams = {
  dashboardDataDir: string | null | undefined;
  pjcode: string | null | undefined;
  assigneeLogin: string | null | undefined;
  issues: Issue[];
  generatedAt?: string;
};

export type DashboardRowFile = DashboardRow & {
  pjcode: string;
  capturedAt: string;
};

const writeJsonAtomic = (filePath: string, data: unknown): void => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, filePath);
};

export const writeDashboardRow = (params: DashboardRowWriterParams): void => {
  const { dashboardDataDir, pjcode, assigneeLogin, issues } = params;
  if (!dashboardDataDir || !pjcode || !assigneeLogin) {
    return;
  }

  const row: DashboardRow = new GenerateDashboardRowUseCase().run({
    issues,
    assigneeLogin,
  });

  const file: DashboardRowFile = {
    pjcode,
    capturedAt: params.generatedAt ?? new Date().toISOString(),
    ...row,
  };

  writeJsonAtomic(
    path.join(dashboardDataDir, 'projects', `${pjcode}.json`),
    file,
  );
};
