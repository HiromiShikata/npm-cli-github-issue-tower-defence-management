import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildComposeDashboardInput,
  composeDashboardText,
} from './dashboardComposeService';

const makeDataDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-compose-'));

const writeProject = (dataDir: string, code: string, body: unknown): void => {
  fs.mkdirSync(path.join(dataDir, 'projects'), { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'projects', `${code}.json`),
    JSON.stringify(body),
  );
};

describe('buildComposeDashboardInput', () => {
  it('reads every requested project code in order and yields null for absent files', () => {
    const dataDir = makeDataDir();
    try {
      writeProject(dataDir, 'um', {
        pjcode: 'um',
        capturedAt: 'x',
        unread: 3,
        todo: 1,
        qc: 2,
        fail: 0,
        pr: 0,
        ws: 4,
        dep: 1,
        blocker: 0,
      });
      const input = buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectCodes: ['um', 'xc'],
      });
      expect(input.projects).toEqual([
        {
          code: 'um',
          row: {
            unread: 3,
            todo: 1,
            qc: 2,
            fail: 0,
            pr: 0,
            ws: 4,
            dep: 1,
            blocker: 0,
          },
        },
        { code: 'xc', row: null },
      ]);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('treats a project file with a missing field as an absent row', () => {
    const dataDir = makeDataDir();
    try {
      writeProject(dataDir, 'um', { unread: 1, todo: 1 });
      const input = buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectCodes: ['um'],
      });
      expect(input.projects[0].row).toBeNull();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('treats malformed JSON as an absent row', () => {
    const dataDir = makeDataDir();
    try {
      fs.mkdirSync(path.join(dataDir, 'projects'), { recursive: true });
      fs.writeFileSync(path.join(dataDir, 'projects', 'um.json'), 'not json');
      const input = buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectCodes: ['um'],
      });
      expect(input.projects[0].row).toBeNull();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('reads machine status from machine-status.json', () => {
    const dataDir = makeDataDir();
    try {
      fs.writeFileSync(
        path.join(dataDir, 'machine-status.json'),
        JSON.stringify({
          memPct: 55,
          cpuPct: 62,
          load: [16, 23, 40],
          cycleMinutes: 14,
          capturedAt: 'x',
        }),
      );
      const input = buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectCodes: [],
      });
      expect(input.machineStatus).toEqual({
        memPct: 55,
        cpuPct: 62,
        load: [16, 23, 40],
        cycleMinutes: 14,
      });
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('preserves a null cycleMinutes from machine-status.json', () => {
    const dataDir = makeDataDir();
    try {
      fs.writeFileSync(
        path.join(dataDir, 'machine-status.json'),
        JSON.stringify({
          memPct: 1,
          cpuPct: 2,
          load: [0, 0, 0],
          cycleMinutes: null,
          capturedAt: 'x',
        }),
      );
      const input = buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectCodes: [],
      });
      expect(input.machineStatus?.cycleMinutes).toBeNull();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('yields a null machine status when the file is absent', () => {
    const dataDir = makeDataDir();
    try {
      const input = buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectCodes: [],
      });
      expect(input.machineStatus).toBeNull();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('reads token statuses from token-status.json and skips malformed entries', () => {
    const dataDir = makeDataDir();
    try {
      fs.writeFileSync(
        path.join(dataDir, 'token-status.json'),
        JSON.stringify({
          tokens: [
            {
              name: 'alice',
              fiveHourUtilizationPercent: 10,
              fiveHourResetSeconds: 3600,
              sevenDayUtilizationPercent: 12,
              sevenDayResetSeconds: 432000,
              color: 'G',
              prep: 2,
              hum: 1,
            },
            { fiveHourUtilizationPercent: 5 },
          ],
          capturedAt: 'x',
        }),
      );
      const input = buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectCodes: [],
      });
      expect(input.tokens).toEqual([
        {
          name: 'alice',
          fiveHourUtilizationPercent: 10,
          fiveHourResetSeconds: 3600,
          sevenDayUtilizationPercent: 12,
          sevenDayResetSeconds: 432000,
          color: 'G',
          prep: 2,
          hum: 1,
        },
      ]);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('defaults an unknown token color to Y and null windows to null', () => {
    const dataDir = makeDataDir();
    try {
      fs.writeFileSync(
        path.join(dataDir, 'token-status.json'),
        JSON.stringify({
          tokens: [
            {
              name: 'bob',
              fiveHourUtilizationPercent: null,
              fiveHourResetSeconds: null,
              sevenDayUtilizationPercent: null,
              sevenDayResetSeconds: null,
              color: 'purple',
              prep: 0,
              hum: 0,
            },
          ],
          capturedAt: 'x',
        }),
      );
      const input = buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectCodes: [],
      });
      expect(input.tokens[0].color).toBe('Y');
      expect(input.tokens[0].fiveHourUtilizationPercent).toBeNull();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('yields an empty token list when the file is absent', () => {
    const dataDir = makeDataDir();
    try {
      const input = buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectCodes: [],
      });
      expect(input.tokens).toEqual([]);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

describe('composeDashboardText', () => {
  it('composes the full byte-identical dashboard text from the data files', () => {
    const dataDir = makeDataDir();
    try {
      writeProject(dataDir, 'um', {
        pjcode: 'um',
        capturedAt: 'x',
        unread: 3,
        todo: 1,
        qc: 2,
        fail: 0,
        pr: 0,
        ws: 4,
        dep: 1,
        blocker: 0,
      });
      fs.writeFileSync(
        path.join(dataDir, 'machine-status.json'),
        JSON.stringify({
          memPct: 55,
          cpuPct: 62,
          load: [16, 23, 40],
          cycleMinutes: 14,
          capturedAt: 'x',
        }),
      );
      fs.writeFileSync(
        path.join(dataDir, 'token-status.json'),
        JSON.stringify({
          tokens: [
            {
              name: 'alice',
              fiveHourUtilizationPercent: 10,
              fiveHourResetSeconds: 3600,
              sevenDayUtilizationPercent: 12,
              sevenDayResetSeconds: 432000,
              color: 'G',
              prep: 2,
              hum: 1,
            },
          ],
          capturedAt: 'x',
        }),
      );
      expect(
        composeDashboardText({
          dashboardDataDir: dataDir,
          projectCodes: ['um', 'xc'],
        }),
      ).toBe(
        '<tt>M55%&nbsp;C62%&nbsp;LA&nbsp;16&nbsp;23&nbsp;40&nbsp;cy14</tt><br>\n' +
          '<tt>pj&nbsp;&nbsp;&nbsp;unr&nbsp;tdo&nbsp;aqc&nbsp;fal&nbsp;prp&nbsp;aws&nbsp;dep</tt><br>\n' +
          '<tt>🟢um&nbsp;&nbsp;&nbsp;3&nbsp;&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;2&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;4&nbsp;&nbsp;&nbsp;1</tt><br>\n' +
          '<tt>&nbsp;&nbsp;xc&nbsp;&nbsp;--&nbsp;&nbsp;--&nbsp;&nbsp;--&nbsp;&nbsp;--&nbsp;&nbsp;--&nbsp;&nbsp;--&nbsp;&nbsp;--</tt><br>\n' +
          '<tt></tt><br>\n' +
          '<tt>🟢alice&nbsp;&nbsp;10%&nbsp;0d01h00&nbsp;&nbsp;12%&nbsp;5d00h00&nbsp;2&nbsp;1</tt><br>\n',
      );
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
