import fs from 'fs';
import path from 'path';
import { FileSystemPrReviewDoneRepository } from './FileSystemPrReviewDoneRepository';

const TEST_DIR = path.join(__dirname, '../../../../tmp/test-done-repo');

describe('FileSystemPrReviewDoneRepository', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('returns empty list when no done PRs exist', async () => {
    const repo = new FileSystemPrReviewDoneRepository(TEST_DIR);
    const result = await repo.getAllDone();
    expect(result).toEqual([]);
  });

  it('marks a PR as done', async () => {
    const repo = new FileSystemPrReviewDoneRepository(TEST_DIR);
    await repo.markDone('owner', 'repo', 42);
    const result = await repo.getAllDone();
    expect(result).toEqual([{ owner: 'owner', repo: 'repo', prNumber: 42 }]);
  });

  it('isDone returns true for marked PR', async () => {
    const repo = new FileSystemPrReviewDoneRepository(TEST_DIR);
    await repo.markDone('owner', 'repo', 42);
    const result = await repo.isDone('owner', 'repo', 42);
    expect(result).toBe(true);
  });

  it('isDone returns false for unmarked PR', async () => {
    const repo = new FileSystemPrReviewDoneRepository(TEST_DIR);
    const result = await repo.isDone('owner', 'repo', 99);
    expect(result).toBe(false);
  });

  it('does not duplicate entries when marking same PR twice', async () => {
    const repo = new FileSystemPrReviewDoneRepository(TEST_DIR);
    await repo.markDone('owner', 'repo', 42);
    await repo.markDone('owner', 'repo', 42);
    const result = await repo.getAllDone();
    expect(result).toHaveLength(1);
  });

  it('persists data across instances', async () => {
    const repo1 = new FileSystemPrReviewDoneRepository(TEST_DIR);
    await repo1.markDone('owner', 'repo', 42);

    const repo2 = new FileSystemPrReviewDoneRepository(TEST_DIR);
    const result = await repo2.getAllDone();
    expect(result).toEqual([{ owner: 'owner', repo: 'repo', prNumber: 42 }]);
  });

  it('supports multiple done PRs', async () => {
    const repo = new FileSystemPrReviewDoneRepository(TEST_DIR);
    await repo.markDone('owner', 'repo', 1);
    await repo.markDone('owner', 'repo', 2);
    await repo.markDone('other', 'other-repo', 3);
    const result = await repo.getAllDone();
    expect(result).toHaveLength(3);
  });
});
