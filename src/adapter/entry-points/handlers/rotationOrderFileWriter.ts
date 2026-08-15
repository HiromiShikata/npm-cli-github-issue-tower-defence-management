import fs from 'fs';
import * as path from 'path';
import type { RotationOrderEntry } from '../../../domain/usecases/StartPreparationUseCase';
import { tdpmCacheDirectory } from '../../repositories/localStorageCacheDirectory';

const rotationOrderFilePath = (): string =>
  path.join(tdpmCacheDirectory(), 'rotation-order.json');

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
