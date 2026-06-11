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
    const hasIssueShape = (issue: unknown): boolean => {
      if (typeof issue !== 'object' || issue === null) {
        return false;
      }
      if (
        !('number' in issue) ||
        !('title' in issue) ||
        !('author' in issue) ||
        !('url' in issue) ||
        !('story' in issue) ||
        !('projectItemId' in issue)
      ) {
        return false;
      }
      return (
        typeof issue['number'] === 'number' &&
        typeof issue['title'] === 'string' &&
        typeof issue['author'] === 'string' &&
        typeof issue['url'] === 'string' &&
        (issue['story'] === null || typeof issue['story'] === 'string') &&
        typeof issue['projectItemId'] === 'string'
      );
    };
    const hasPrShape = (pr: unknown): boolean => {
      if (typeof pr !== 'object' || pr === null) {
        return false;
      }
      if (
        !('number' in pr) ||
        !('repo' in pr) ||
        !('title' in pr) ||
        !('additions' in pr) ||
        !('deletions' in pr) ||
        !('changedFiles' in pr) ||
        !('url' in pr)
      ) {
        return false;
      }
      return (
        typeof pr['number'] === 'number' &&
        typeof pr['repo'] === 'string' &&
        typeof pr['title'] === 'string' &&
        typeof pr['additions'] === 'number' &&
        typeof pr['deletions'] === 'number' &&
        typeof pr['changedFiles'] === 'number' &&
        typeof pr['url'] === 'string'
      );
    };
    const isPrReviewViewerItem = (
      item: unknown,
    ): item is PrReviewViewerItem => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }
      if (!('issue' in item) || !('pr' in item)) {
        return false;
      }
      return hasIssueShape(item['issue']) && hasPrShape(item['pr']);
    };
    return parsed.filter(isPrReviewViewerItem);
  };
}
