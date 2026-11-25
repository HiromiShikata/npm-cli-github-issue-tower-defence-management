import {
  ComposeDashboardInput,
  ComposeDashboardRemoteMachine,
  ComposeDashboardUseCase,
  formatMachineStatusLines,
} from './ComposeDashboardUseCase';

const mainLoad: [number, number, number] = [5, 16, 29];
const mainStatus = {
  memPct: 43,
  cpuPct: 51,
  diskPct: 78,
  disks: [{ title: 'S', pct: 53 }],
  load: mainLoad,
  cycleMinutes: 0,
};

const reachableWorker: ComposeDashboardRemoteMachine = {
  name: 'worker-a',
  reachable: true,
  memPct: 23,
  cpuPct: 61,
  diskPct: 69,
  load: [33, 78, 75],
};

describe('formatMachineStatusLines remote machine table', () => {
  it('renders the main row with the fixed header and S disk column', () => {
    expect(formatMachineStatusLines(mainStatus)).toEqual([
      '            M  C  D  S cy LA',
      '🟡main     43 51 78 53  0  5 16 29',
    ]);
  });

  it('renders a reachable remote row and pads names to the widest row', () => {
    expect(formatMachineStatusLines(mainStatus, [reachableWorker])).toEqual([
      '            M  C  D  S cy LA',
      '🟡main     43 51 78 53  0  5 16 29',
      '🔴worker-a 23 61 69  -  - 33 78 75',
    ]);
  });

  it('renders an unreachable remote as a forced-red row of placeholders', () => {
    expect(
      formatMachineStatusLines(mainStatus, [
        {
          ...reachableWorker,
          reachable: false,
          memPct: null,
          cpuPct: null,
          diskPct: null,
          load: null,
        },
      ]),
    ).toEqual([
      '            M  C  D  S cy LA',
      '🟡main     43 51 78 53  0  5 16 29',
      '🔴worker-a  ?  ?  ?  ?  ?  ?  ?  ?',
    ]);
  });

  it('applies red and yellow thresholds, rounds loads, and caps values at 99', () => {
    expect(
      formatMachineStatusLines({
        memPct: 100,
        cpuPct: 80,
        diskPct: 1,
        load: [4.5, 1.5, 2.5],
        cycleMinutes: null,
      }),
    ).toEqual(['        M  C  D  S cy LA', '🔴main   99 80  1  -  -  4  2  2']);
  });

  it('forces all columns red when the main machine status is null', () => {
    expect(formatMachineStatusLines(null)).toEqual([
      '        M  C  D  S cy LA',
      '🔴main   ?  ?  ?  ?  ?  ?  ?  ?',
    ]);
  });
});

describe('ComposeDashboardUseCase remote machine output', () => {
  it('starts the composed dashboard with the remote-machine table header', () => {
    const input: ComposeDashboardInput = {
      machineStatus: mainStatus,
      remoteMachines: [reachableWorker],
      projects: [],
      tokens: [],
    };
    expect(new ComposeDashboardUseCase().run(input)).toMatch(
      new RegExp(
        `^<tt>${'&nbsp;'.repeat(12)}M&nbsp;&nbsp;C&nbsp;&nbsp;D&nbsp;&nbsp;S&nbsp;cy&nbsp;LA<\\/tt><br>\\n<tt>`,
      ),
    );
  });
});
