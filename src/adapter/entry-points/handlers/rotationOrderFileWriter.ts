import fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { RotationOrderEntry } from '../../../domain/usecases/StartPreparationUseCase';

const rotationOrderFilePath = (): string => {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  return path.join(base, 'tdpm', 'rotation-order.json');
};

export type RotationOrderFileEntry = {
  name: string;
  fiveHourUtilization: number;
  blocked: boolean;
  rejected: boolean;
  thresholdExcluded: boolean;
};

export const writeRotationOrderFile = (
  rotationOrder: RotationOrderEntry[],
): void => {
  const filePath = rotationOrderFilePath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const entries: RotationOrderFileEntry[] = rotationOrder.map((entry) => ({
    name: entry.name,
    fiveHourUtilization: entry.fiveHourUtilization,
    blocked: entry.blocked,
    rejected: entry.rejected,
    thresholdExcluded: entry.thresholdExcluded,
  }));
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(entries));
  fs.renameSync(tmpPath, filePath);
};
