import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildComposeDashboardInput,
  readRemoteMachineStatus,
} from './dashboardComposeService';

describe('readRemoteMachineStatus', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'remote-machine-dashboard-'),
    );
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('returns null for a missing or malformed status file', () => {
    expect(readRemoteMachineStatus(dataDir)).toBeNull();
    fs.writeFileSync(
      path.join(dataDir, 'remote-machine-status.json'),
      JSON.stringify({ machines: {} }),
    );
    expect(readRemoteMachineStatus(dataDir)).toBeNull();
  });

  it('keeps valid entries in order, skips nameless entries, and normalizes fields', () => {
    fs.writeFileSync(
      path.join(dataDir, 'remote-machine-status.json'),
      JSON.stringify({
        capturedAt: '2026-11-25T00:00:00.000Z',
        machines: [
          {
            name: 'worker-a',
            reachable: true,
            memPct: 23,
            cpuPct: 61,
            diskPct: 69,
            load: [33, 78, 75],
          },
          { reachable: true },
          {
            name: 'worker-b',
            reachable: 1,
            memPct: 'bad',
            cpuPct: 0,
            diskPct: null,
            load: [1, 2, 3],
          },
        ],
      }),
    );
    expect(readRemoteMachineStatus(dataDir)).toEqual([
      {
        name: 'worker-a',
        reachable: true,
        memPct: 23,
        cpuPct: 61,
        diskPct: 69,
        load: [33, 78, 75],
      },
      {
        name: 'worker-b',
        reachable: false,
        memPct: null,
        cpuPct: 0,
        diskPct: null,
        load: [1, 2, 3],
      },
    ]);
  });

  it('passes the read remote machines into the dashboard input', () => {
    fs.writeFileSync(
      path.join(dataDir, 'remote-machine-status.json'),
      JSON.stringify({
        machines: [
          {
            name: 'worker-a',
            reachable: true,
            memPct: 1,
            cpuPct: 2,
            diskPct: 3,
            load: [4, 5, 6],
          },
        ],
      }),
    );
    expect(
      buildComposeDashboardInput({
        dashboardDataDir: dataDir,
        projectNames: [],
      }).remoteMachines,
    ).toEqual([
      {
        name: 'worker-a',
        reachable: true,
        memPct: 1,
        cpuPct: 2,
        diskPct: 3,
        load: [4, 5, 6],
      },
    ]);
  });
});
