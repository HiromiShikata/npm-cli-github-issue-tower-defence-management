import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildComposeDashboardInput } from './dashboardComposeService';

const makeDataDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-codex-window-'));

const writeCodexWindowFile = (
  dataDir: string,
  pjcode: string,
  body: unknown,
): void => {
  const dir = path.join(dataDir, 'codex-seven-day-window');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${pjcode}.json`), JSON.stringify(body));
};

const window = (
  codexHome: string,
  usedPercent: number | null,
  state: string = 'observed',
): Record<string, unknown> => ({
  codexHome,
  state,
  usedPercent,
  resetsAtEpochSeconds: 1795004568,
  capturedAt: '2026-11-18T02:16:17.179Z',
  errorMessage: null,
});

describe('buildComposeDashboardInput Codex seven day windows', () => {
  it('returns an empty list when no Codex window file exists', () => {
    const dataDir = makeDataDir();
    try {
      const input = buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectNames: ['acme'],
      });
      expect(input.codexSevenDayWindows).toEqual([]);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('merges the windows of every project file, keeping the newest file per Codex home and sorting by label', () => {
    const dataDir = makeDataDir();
    try {
      writeCodexWindowFile(dataDir, 'acme', {
        capturedAt: '2026-11-18T02:20:00.000Z',
        windows: [window('.codex', 11), window('.codex-b', null, 'no-data')],
      });
      writeCodexWindowFile(dataDir, 'beta', {
        capturedAt: '2026-11-17T01:00:00.000Z',
        windows: [window('.codex', 3)],
      });
      const input = buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectNames: ['acme'],
      });
      expect(input.codexSevenDayWindows).toEqual([
        {
          codexHome: '.codex',
          state: 'observed',
          usedPercent: 11,
          resetsAtEpochSeconds: 1795004568,
          capturedAt: '2026-11-18T02:16:17.179Z',
          errorMessage: null,
        },
        {
          codexHome: '.codex-b',
          state: 'no-data',
          usedPercent: null,
          resetsAtEpochSeconds: 1795004568,
          capturedAt: '2026-11-18T02:16:17.179Z',
          errorMessage: null,
        },
      ]);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('skips malformed entries and entries with an unknown state', () => {
    const dataDir = makeDataDir();
    try {
      writeCodexWindowFile(dataDir, 'acme', {
        capturedAt: '2026-11-18T02:20:00.000Z',
        windows: [window('.codex', 11, 'bogus'), { state: 'observed' }, 'x'],
      });
      const input = buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectNames: ['acme'],
      });
      expect(input.codexSevenDayWindows).toEqual([]);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
