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
    expect(parseConsoleDataRoute('/projects/acme/prs/list.json')).toEqual({
      kind: 'list',
      pjcode: 'acme',
      tab: 'prs',
    });
  });

  it('parses a list route for todo-by-human', () => {
    expect(
      parseConsoleDataRoute('/projects/acme/todo-by-human/list.json'),
    ).toEqual({ kind: 'list', pjcode: 'acme', tab: 'todo-by-human' });
  });

  it('parses a list route for todo-by-agent', () => {
    expect(
      parseConsoleDataRoute('/projects/acme/todo-by-agent/list.json'),
    ).toEqual({ kind: 'list', pjcode: 'acme', tab: 'todo-by-agent' });
  });

  it('parses a detail route', () => {
    expect(
      parseConsoleDataRoute('/projects/acme/triage/detail/123.json'),
    ).toEqual({
      kind: 'detail',
      pjcode: 'acme',
      tab: 'triage',
      key: '123.json',
    });
  });

  it('parses an in-tmux route', () => {
    expect(
      parseConsoleDataRoute('/projects/acme/in-tmux-by-human/list.json'),
    ).toEqual({
      kind: 'in-tmux',
      pjcode: 'acme',
      relativePath: 'list.json',
    });
  });

  it('parses a nested in-tmux route', () => {
    expect(
      parseConsoleDataRoute('/projects/acme/in-tmux-by-human/sub/data.json'),
    ).toEqual({
      kind: 'in-tmux',
      pjcode: 'acme',
      relativePath: 'sub/data.json',
    });
  });

  it('rejects unknown tabs', () => {
    expect(
      parseConsoleDataRoute('/projects/acme/unknown/list.json'),
    ).toBeNull();
  });

  it('rejects a non-projects prefix', () => {
    expect(parseConsoleDataRoute('/other/acme/prs/list.json')).toBeNull();
  });

  it('rejects dot segments in pjcode or tab', () => {
    expect(parseConsoleDataRoute('/projects/../prs/list.json')).toBeNull();
    expect(parseConsoleDataRoute('/projects/acme/../list.json')).toBeNull();
  });

  it('rejects a non-json detail key', () => {
    expect(
      parseConsoleDataRoute('/projects/acme/prs/detail/123.txt'),
    ).toBeNull();
  });

  it('rejects an empty in-tmux relative path', () => {
    expect(parseConsoleDataRoute('/projects/acme/in-tmux-by-human')).toBeNull();
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
      pjcode: 'acme',
      tab: 'prs',
    });
    expect(response.statusCode).toBe(404);
  });

  it('serves a list file without filtering items that have done records', () => {
    writeJson('acme/prs/list.json', {
      pjcode: 'acme',
      items: [
        { projectItemId: 'PVTI_1', title: 'keep' },
        { projectItemId: 'PVTI_2', title: 'also keep despite done record' },
      ],
    });
    recordDoneProjectItemId(baseDir, 'acme', 'prs', 'PVTI_2');
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'list',
      pjcode: 'acme',
      tab: 'prs',
    });
    expect(response.statusCode).toBe(200);
    const parsed: unknown = JSON.parse(response.body);
    expect(parsed).toEqual({
      pjcode: 'acme',
      items: [
        { projectItemId: 'PVTI_1', title: 'keep' },
        { projectItemId: 'PVTI_2', title: 'also keep despite done record' },
      ],
    });
  });

  it('serves the workflow-blocker list without filtering items that have done records', () => {
    writeJson('acme/workflow-blocker/list.json', {
      pjcode: 'acme',
      items: [
        { projectItemId: 'PVTI_1', title: 'keep' },
        { projectItemId: 'PVTI_2', title: 'also keep despite done record' },
      ],
    });
    recordDoneProjectItemId(baseDir, 'acme', 'workflow-blocker', 'PVTI_2');
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'list',
      pjcode: 'acme',
      tab: 'workflow-blocker',
    });
    expect(response.statusCode).toBe(200);
    const parsed: unknown = JSON.parse(response.body);
    expect(parsed).toEqual({
      pjcode: 'acme',
      items: [
        { projectItemId: 'PVTI_1', title: 'keep' },
        { projectItemId: 'PVTI_2', title: 'also keep despite done record' },
      ],
    });
  });

  it('serves a list file without an items array unchanged', () => {
    writeJson('acme/prs/list.json', { pjcode: 'acme' });
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'list',
      pjcode: 'acme',
      tab: 'prs',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ pjcode: 'acme' });
  });

  it('serves a detail file without exclusion', () => {
    writeJson('acme/triage/detail/123.json', { number: 123 });
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'detail',
      pjcode: 'acme',
      tab: 'triage',
      key: '123.json',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ number: 123 });
  });

  it('returns 404 when the detail file is absent', () => {
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'detail',
      pjcode: 'acme',
      tab: 'triage',
      key: '404.json',
    });
    expect(response.statusCode).toBe(404);
  });

  it('serves an in-tmux file', () => {
    writeJson('acme/in-tmux-by-human/list.json', { items: [] });
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'in-tmux',
      pjcode: 'acme',
      relativePath: 'list.json',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ items: [] });
  });

  it('returns 404 when the in-tmux file is absent', () => {
    const response = buildConsoleDataResponse(baseDir, {
      kind: 'in-tmux',
      pjcode: 'acme',
      relativePath: 'missing.json',
    });
    expect(response.statusCode).toBe(404);
  });
});
