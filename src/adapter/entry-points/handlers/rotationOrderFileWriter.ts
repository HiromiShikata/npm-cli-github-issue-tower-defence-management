import fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { RotationOrderEntry } from '../../../domain/usecases/StartPreparationUseCase';

const rotationOrderFilePath = (): string => {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  return path.join(base, 'tdpm', 'rotation-order.json');
};

export const writeRotationOrderFile = (
  rotationOrder: RotationOrderEntry[],
): void => {
  const filePath = rotationOrderFilePath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(rotationOrder));
  fs.renameSync(tmpPath, filePath);
};
