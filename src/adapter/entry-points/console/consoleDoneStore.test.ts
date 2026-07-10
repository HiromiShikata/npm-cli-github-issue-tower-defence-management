import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CONSOLE_DONE_FILE_NAME,
  CONSOLE_DONE_TAB_NAMES,
  doneFilePathForTab,
  readDoneProjectItemIds,
  recordDoneProjectItemId,
  recordDoneProjectItemIdAcrossTabs,
} from './consoleDoneStore';

describe('consoleDoneStore', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-done-'));
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  describe('doneFilePathForTab', () => {
    it('places the done file under pjcode/tab', () => {
      expect(doneFilePathForTab(baseDir, 'umino', 'prs')).toBe(
        path.join(baseDir, 'umino', 'prs', CONSOLE_DONE_FILE_NAME),
      );
    });
  });

  describe('readDoneProjectItemIds', () => {
    it('returns an empty array when the file is absent', () => {
      expect(readDoneProjectItemIds(baseDir, 'umino', 'prs')).toEqual([]);
    });

    it('returns the persisted project item ids', () => {
      recordDoneProjectItemId(baseDir, 'umino', 'prs', 'PVTI_1');
      recordDoneProjectItemId(baseDir, 'umino', 'prs', 'PVTI_2');
      expect(readDoneProjectItemIds(baseDir, 'umino', 'prs')).toEqual([
        'PVTI_1',
        'PVTI_2',
      ]);
    });

    it('returns an empty array for malformed json', () => {
      const filePath = doneFilePathForTab(baseDir, 'umino', 'prs');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, '{ not json');
      expect(() => readDoneProjectItemIds(baseDir, 'umino', 'prs')).toThrow();
    });

    it('returns an empty array when projectItemIds is not an array', () => {
      const filePath = doneFilePathForTab(baseDir, 'umino', 'prs');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify({ projectItemIds: 'x' }));
      expect(readDoneProjectItemIds(baseDir, 'umino', 'prs')).toEqual([]);
    });

    it('filters out non-string entries', () => {
      const filePath = doneFilePathForTab(baseDir, 'umino', 'prs');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(
        filePath,
        JSON.stringify({ projectItemIds: ['PVTI_1', 1, null, ''] }),
      );
      expect(readDoneProjectItemIds(baseDir, 'umino', 'prs')).toEqual([
        'PVTI_1',
      ]);
    });
  });

  describe('recordDoneProjectItemId', () => {
    it('does not record an empty id', () => {
      recordDoneProjectItemId(baseDir, 'umino', 'prs', '');
      expect(readDoneProjectItemIds(baseDir, 'umino', 'prs')).toEqual([]);
    });

    it('does not duplicate an already recorded id', () => {
      recordDoneProjectItemId(baseDir, 'umino', 'prs', 'PVTI_1');
      recordDoneProjectItemId(baseDir, 'umino', 'prs', 'PVTI_1');
      expect(readDoneProjectItemIds(baseDir, 'umino', 'prs')).toEqual([
        'PVTI_1',
      ]);
    });
  });

  describe('recordDoneProjectItemIdAcrossTabs', () => {
    it('records the id into every tab done file', () => {
      recordDoneProjectItemIdAcrossTabs(baseDir, 'umino', 'PVTI_99');
      for (const tab of CONSOLE_DONE_TAB_NAMES) {
        expect(readDoneProjectItemIds(baseDir, 'umino', tab)).toEqual([
          'PVTI_99',
        ]);
      }
    });

    it('includes the workflow-blocker tab so processed blockers are excluded', () => {
      expect(CONSOLE_DONE_TAB_NAMES).toContain('workflow-blocker');
      recordDoneProjectItemIdAcrossTabs(baseDir, 'umino', 'PVTI_7');
      expect(
        readDoneProjectItemIds(baseDir, 'umino', 'workflow-blocker'),
      ).toEqual(['PVTI_7']);
    });
  });
});
