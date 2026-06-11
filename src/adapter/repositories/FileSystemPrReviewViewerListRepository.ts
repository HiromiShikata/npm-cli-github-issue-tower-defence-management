import fs from 'fs';
import path from 'path';
import { PrReviewViewerListRepository } from '../../domain/usecases/adapter-interfaces/PrReviewViewerRepository';
import { PrReviewViewerItem } from '../../domain/entities/PrReviewViewerItem';

export class FileSystemPrReviewViewerListRepository implements PrReviewViewerListRepository {
  constructor(private readonly dataDir: string) {}

  getList = async (projectCode: string): Promise<PrReviewViewerItem[]> => {
    const filePath = path.join(
      this.dataDir,
      projectCode,
      'awaiting_quality_check.json',
    );
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is PrReviewViewerItem =>
        typeof item === 'object' && item !== null,
    );
  };
}
