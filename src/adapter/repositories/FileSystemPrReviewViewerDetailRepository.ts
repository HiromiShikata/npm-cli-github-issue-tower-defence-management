import fs from 'fs';
import path from 'path';
import { PrReviewViewerDetailRepository } from '../../domain/usecases/adapter-interfaces/PrReviewViewerRepository';

export class FileSystemPrReviewViewerDetailRepository
  implements PrReviewViewerDetailRepository
{
  constructor(private readonly dataDir: string) {}

  getDetail = async (
    projectCode: string,
    repo: string,
    prNumber: number,
  ): Promise<object | null> => {
    const sanitizedRepo = repo.replace(/\//g, '__');
    const filePath = path.join(
      this.dataDir,
      projectCode,
      'prs',
      `${sanitizedRepo}__${prNumber}.json`,
    );
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed;
  };
}
