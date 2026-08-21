import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Project } from '../../../domain/entities/Project';
import { writeConsoleLists } from '../handlers/consoleListsWriter';
import { parseConsoleDataRoute } from './consoleDataDelivery';
import { CONSOLE_LIST_TAB_NAMES } from './consoleTabNames';

const createMinimalProject = (): Project => ({
  id: 'p1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test',
  status: { name: 'Status', fieldId: 'f1', statuses: [] },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
});

describe('consoleTabNames cross-component contract', () => {
  it('every CONSOLE_LIST_TAB_NAMES tab is recognised as a valid list route by the data delivery parser', () => {
    for (const tab of CONSOLE_LIST_TAB_NAMES) {
      const route = parseConsoleDataRoute(`/projects/testpj/${tab}/list.json`);
      expect(route).toMatchObject({ kind: 'list', pjcode: 'testpj', tab });
    }
  });

  it('writeConsoleLists creates a list.json file for every CONSOLE_LIST_TAB_NAMES tab', () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'console-tab-names-contract-test-'),
    );
    try {
      writeConsoleLists({
        consoleDataOutputDir: dir,
        pjcode: 'testpj',
        assigneeLogin: 'user',
        project: createMinimalProject(),
        issues: [],
      });
      for (const tab of CONSOLE_LIST_TAB_NAMES) {
        const filePath = path.join(dir, 'testpj', tab, 'list.json');
        expect(fs.existsSync(filePath)).toBe(true);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
