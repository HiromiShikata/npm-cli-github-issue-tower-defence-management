import fs from 'fs';
import path from 'path';
import type { QualityCheckViewerOutput } from '../../../domain/usecases/RevertNotReadyAwaitingQualityCheckUseCase';
import { isRecord } from '../../typeGuards';

const extractPrUrlFromEntry = (entry: unknown): string => {
  if (typeof entry === 'string') return entry;
  if (isRecord(entry)) {
    const urlValue = entry['url'];
    if (typeof urlValue === 'string') return urlValue;
  }
  return '';
};

export const readDoneStorePrUrls = (doneStorePath: string): Set<string> => {
  try {
    const raw = fs.readFileSync(doneStorePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(
        parsed.map(extractPrUrlFromEntry).filter((url) => url !== ''),
      );
    }
    return new Set<string>();
  } catch {
    return new Set<string>();
  }
};

export const writeAwaitingQualityCheckViewerFile = (
  output: QualityCheckViewerOutput,
  outputPath: string,
): void => {
  const outputDir = path.dirname(outputPath);
  const tmpPath = `${outputPath}.tmp`;
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(output, null, 2));
  fs.rmSync(outputPath, { force: true });
  fs.renameSync(tmpPath, outputPath);
};
