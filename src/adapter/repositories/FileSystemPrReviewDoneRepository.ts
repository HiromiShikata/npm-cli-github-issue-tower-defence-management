import fs from 'fs';
import path from 'path';
import { PrReviewDoneRepository } from '../../domain/usecases/adapter-interfaces/PrReviewViewerRepository';

type DoneRecord = {
  owner: string;
  repo: string;
  prNumber: number;
  doneAt: string;
};

export class FileSystemPrReviewDoneRepository implements PrReviewDoneRepository {
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'done_prs.json');
  }

  private isDoneRecord = (value: unknown): value is DoneRecord => {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    if (
      !('owner' in value) ||
      !('repo' in value) ||
      !('prNumber' in value) ||
      !('doneAt' in value)
    ) {
      return false;
    }
    return (
      typeof value['owner'] === 'string' &&
      typeof value['repo'] === 'string' &&
      typeof value['prNumber'] === 'number' &&
      typeof value['doneAt'] === 'string'
    );
  };

  private readRecords = (): DoneRecord[] => {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(this.isDoneRecord);
    } catch (_error) {
      process.stderr.write(String(_error) + '\n');
      return [];
    }
  };

  private writeRecords = (records: DoneRecord[]): void => {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(records, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  };

  markDone = async (
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<void> => {
    const records = this.readRecords();
    const alreadyExists = records.some(
      (r) => r.owner === owner && r.repo === repo && r.prNumber === prNumber,
    );
    if (alreadyExists) {
      return;
    }
    records.push({ owner, repo, prNumber, doneAt: new Date().toISOString() });
    this.writeRecords(records);
  };

  isDone = async (
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<boolean> => {
    const records = this.readRecords();
    return records.some(
      (r) => r.owner === owner && r.repo === repo && r.prNumber === prNumber,
    );
  };

  getAllDone = async (): Promise<
    { owner: string; repo: string; prNumber: number }[]
  > => {
    return this.readRecords().map(({ owner, repo, prNumber }) => ({
      owner,
      repo,
      prNumber,
    }));
  };
}
