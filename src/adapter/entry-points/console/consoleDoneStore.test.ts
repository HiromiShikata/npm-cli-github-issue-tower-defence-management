import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CONSOLE_DONE_FILE_NAME,
  CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES,
  CONSOLE_DONE_STORY_SELECTED_TAB_NAMES,
  CONSOLE_DONE_TAB_NAMES,
  doneFilePathForTab,
  readDoneProjectItemIds,
  recordDoneProjectItemId,
  recordDoneProjectItemIdAcrossTabs,
  resetDoneProjectItemIds,
  resetDoneProjectItemIdsAcrossTabs,
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
      expect(doneFilePathForTab(baseDir, 'acme', 'prs')).toBe(
        path.join(baseDir, 'acme', 'prs', CONSOLE_DONE_FILE_NAME),
      );
    });
  });

  describe('readDoneProjectItemIds', () => {
    it('returns an empty array when the file is absent', () => {
      expect(readDoneProjectItemIds(baseDir, 'acme', 'prs')).toEqual([]);
    });

    it('returns the persisted project item ids', () => {
      recordDoneProjectItemId(baseDir, 'acme', 'prs', 'PVTI_1');
      recordDoneProjectItemId(baseDir, 'acme', 'prs', 'PVTI_2');
      expect(readDoneProjectItemIds(baseDir, 'acme', 'prs')).toEqual([
        'PVTI_1',
        'PVTI_2',
      ]);
    });

    it('returns an empty array for malformed json', () => {
      const filePath = doneFilePathForTab(baseDir, 'acme', 'prs');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, '{ not json');
      expect(() => readDoneProjectItemIds(baseDir, 'acme', 'prs')).toThrow();
    });

    it('returns an empty array when projectItemIds is not an array', () => {
      const filePath = doneFilePathForTab(baseDir, 'acme', 'prs');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify({ projectItemIds: 'x' }));
      expect(readDoneProjectItemIds(baseDir, 'acme', 'prs')).toEqual([]);
    });

    it('filters out non-string entries', () => {
      const filePath = doneFilePathForTab(baseDir, 'acme', 'prs');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(
        filePath,
        JSON.stringify({ projectItemIds: ['PVTI_1', 1, null, ''] }),
      );
      expect(readDoneProjectItemIds(baseDir, 'acme', 'prs')).toEqual([
        'PVTI_1',
      ]);
    });
  });

  describe('recordDoneProjectItemId', () => {
    it('does not record an empty id', () => {
      recordDoneProjectItemId(baseDir, 'acme', 'prs', '');
      expect(readDoneProjectItemIds(baseDir, 'acme', 'prs')).toEqual([]);
    });

    it('does not duplicate an already recorded id', () => {
      recordDoneProjectItemId(baseDir, 'acme', 'prs', 'PVTI_1');
      recordDoneProjectItemId(baseDir, 'acme', 'prs', 'PVTI_1');
      expect(readDoneProjectItemIds(baseDir, 'acme', 'prs')).toEqual([
        'PVTI_1',
      ]);
    });
  });

  describe('recordDoneProjectItemIdAcrossTabs', () => {
    it('records the id into every tab done file', () => {
      recordDoneProjectItemIdAcrossTabs(baseDir, 'acme', 'PVTI_99');
      for (const tab of CONSOLE_DONE_TAB_NAMES) {
        expect(readDoneProjectItemIds(baseDir, 'acme', tab)).toEqual([
          'PVTI_99',
        ]);
      }
    });

    it('includes the todo-by-agent tab so processed items are excluded', () => {
      expect(CONSOLE_DONE_TAB_NAMES).toContain('todo-by-agent');
    });

    it('includes the workflow-blocker tab so processed blockers are excluded', () => {
      expect(CONSOLE_DONE_TAB_NAMES).toContain('workflow-blocker');
      recordDoneProjectItemIdAcrossTabs(baseDir, 'acme', 'PVTI_7');
      expect(
        readDoneProjectItemIds(baseDir, 'acme', 'workflow-blocker'),
      ).toEqual(['PVTI_7']);
    });
  });

  describe('resetDoneProjectItemIds', () => {
    it('clears an accumulated done file to an empty record', () => {
      recordDoneProjectItemId(baseDir, 'acme', 'prs', 'PVTI_1');
      recordDoneProjectItemId(baseDir, 'acme', 'prs', 'PVTI_2');
      recordDoneProjectItemId(baseDir, 'acme', 'prs', 'PVTI_3');
      resetDoneProjectItemIds(baseDir, 'acme', 'prs');
      expect(readDoneProjectItemIds(baseDir, 'acme', 'prs')).toEqual([]);
    });

    it('writes an empty record when no done file exists yet', () => {
      resetDoneProjectItemIds(baseDir, 'acme', 'prs');
      const filePath = doneFilePathForTab(baseDir, 'acme', 'prs');
      const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(raw).toEqual({ projectItemIds: [] });
    });

    it('does not leave a temp file behind', () => {
      resetDoneProjectItemIds(baseDir, 'acme', 'prs');
      const filePath = doneFilePathForTab(baseDir, 'acme', 'prs');
      expect(fs.existsSync(`${filePath}.tmp`)).toBe(false);
    });
  });

  describe('resetDoneProjectItemIdsAcrossTabs', () => {
    it('clears the done file of every tab including in-tmux-by-human', () => {
      expect(CONSOLE_DONE_TAB_NAMES).toContain('in-tmux-by-human');
      for (const tab of CONSOLE_DONE_TAB_NAMES) {
        recordDoneProjectItemId(baseDir, 'acme', tab, 'PVTI_1');
      }
      resetDoneProjectItemIdsAcrossTabs(baseDir, 'acme');
      for (const tab of CONSOLE_DONE_TAB_NAMES) {
        expect(readDoneProjectItemIds(baseDir, 'acme', tab)).toEqual([]);
      }
    });
  });

  describe('selector partitions of the console done tabs', () => {
    it('covers every console done tab exactly once across the status and story partitions', () => {
      expect(
        [
          ...CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES,
          ...CONSOLE_DONE_STORY_SELECTED_TAB_NAMES,
        ].sort(),
      ).toEqual([...CONSOLE_DONE_TAB_NAMES].sort());
    });

    it('places no console done tab in both the status and the story partition', () => {
      expect(
        CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES.filter((tab) =>
          CONSOLE_DONE_STORY_SELECTED_TAB_NAMES.includes(tab),
        ),
      ).toEqual([]);
    });
  });
});
