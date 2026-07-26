import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildConsoleDataResponse,
  parseConsoleDataRoute,
} from './consoleDataDelivery';
import { recordDoneProjectItemId } from './consoleDoneStore';

describe('parseConsoleDataRoute', () => {
  it('parses a list route', () => {
    expect(parseConsoleDataRoute('/projects/umino/prs/list.json')).toEqual({
      kind: 'list',
      pjcode: 'umino',
      tab: 'prs',
    });
  });

  it('parses a list route for todo-by-human', () => {
    expect(
      parseConsoleDataRoute('/projects/umino/todo-by-human/list.json'),
    ).toEqual({ kind: 'list', pjcode: 'umino', tab: 'todo-by-human' });
  });

  it('parses a list route for todo-by-agent', () => {
    expect(
      parseConsoleDataRoute('/projects/umino/todo-by-agent/list.json'),
    ).toEqual({ kind: 'list', pjcode: 'umino', tab: 'todo-by-agent' });
  });

  it('parses a detail route', () => {
    expect(
      parseConsoleDataRoute('/projects/umino/triage/detail/123.json'),
    ).toEqual({
      kind: 'detail',
      pjcode: 'umino',
      tab: 'triage',
      key: '123.json',
    });
  });

  it('parses an in-tmux route', () => {
    expect(
      parseConsoleDataRoute('/projects/umino/in-tmux-by-human/list.json'),
    ).toEqual({
      kind: 'in-tmux',
      pjcode: 'umino',
      relativePath: 'list.json',
    });
  });

  it('parses a nested in-tmux route', () => {
    expect(
      parseConsoleDataRoute('/projects/umino/in-tmux-by-human/sub/data.json'),
    ).toEqual({
      kind: 'in-tmux',
      pjcode: 'umino',
      relativePath: 'sub/data.json',
    });
  });

  it('rejects unknown tabs', () => {
    expect(
      parseConsoleDataRoute('/projects/umino/unknown/list.json'),
    ).toBeNull();
  });

  it('rejects a non-projects prefix', () => {
    expect(parseConsoleDataRoute('/other/umino/prs/list.json')).toBeNull();
  });

  it('rejects dot segments in pjcode or tab', () => {
    expect(parseConsoleDataRoute('/projects/../prs/list.json')).toBeNull();
    expect(parseConsoleDataRoute('/projects/umino/../list.json')).toBeNull();
  });

  it('rejects a non-json detail key', () => {
    expect(
      parseConsoleDataRoute('/projects/umino/prs/detail/123.txt'),
    ).toBeNull();
  });

  it('rejects an empty in-tmux relative path', () => {
    expect(
      parseConsoleDataRoute('/projects/umino/in-tmux-by-human'),
    ).toBeNull();
  });
});

describe('buildConsoleDataResponse', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-data-'));
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  const writeJson = (relativePath: string, data: unknown): void => {
    const filePath = path.join(baseDir, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data));
  };

  it('returns 404 when the list file is absent', () => {
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'list',
      pjcode: 'umino',
      tab: 'prs',
    });
    expect(response.statusCode).toBe(404);
  });

  it('serves a list file and applies the done exclusion', () => {
    writeJson('umino/prs/list.json', {
      pjcode: 'umino',
      items: [
        { projectItemId: 'PVTI_1', title: 'keep' },
        { projectItemId: 'PVTI_2', title: 'drop' },
      ],
    });
    recordDoneProjectItemId(baseDir, 'umino', 'prs', 'PVTI_2');
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'list',
      pjcode: 'umino',
      tab: 'prs',
    });
    expect(response.statusCode).toBe(200);
    const parsed: unknown = JSON.parse(response.body);
    expect(parsed).toEqual({
      pjcode: 'umino',
      items: [{ projectItemId: 'PVTI_1', title: 'keep' }],
    });
  });

  it('applies the done exclusion to the workflow-blocker list', () => {
    writeJson('umino/workflow-blocker/list.json', {
      pjcode: 'umino',
      items: [
        { projectItemId: 'PVTI_1', title: 'keep' },
        { projectItemId: 'PVTI_2', title: 'processed blocker' },
      ],
    });
    recordDoneProjectItemId(baseDir, 'umino', 'workflow-blocker', 'PVTI_2');
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'list',
      pjcode: 'umino',
      tab: 'workflow-blocker',
    });
    expect(response.statusCode).toBe(200);
    const parsed: unknown = JSON.parse(response.body);
    expect(parsed).toEqual({
      pjcode: 'umino',
      items: [{ projectItemId: 'PVTI_1', title: 'keep' }],
    });
  });

  it('serves a list file without an items array unchanged', () => {
    writeJson('umino/prs/list.json', { pjcode: 'umino' });
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'list',
      pjcode: 'umino',
      tab: 'prs',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ pjcode: 'umino' });
  });

  it('serves a detail file without exclusion', () => {
    writeJson('umino/triage/detail/123.json', { number: 123 });
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'detail',
      pjcode: 'umino',
      tab: 'triage',
      key: '123.json',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ number: 123 });
  });

  it('returns 404 when the detail file is absent', () => {
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'detail',
      pjcode: 'umino',
      tab: 'triage',
      key: '404.json',
    });
    expect(response.statusCode).toBe(404);
  });

  it('serves an in-tmux file', () => {
    writeJson('umino/in-tmux-by-human/list.json', { items: [] });
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'in-tmux',
      pjcode: 'umino',
      relativePath: 'list.json',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ items: [] });
  });

  it('returns 404 when the in-tmux file is absent', () => {
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'in-tmux',
      pjcode: 'umino',
      relativePath: 'missing.json',
    });
    expect(response.statusCode).toBe(404);
  });
});
