import * as net from 'net';
import * as path from 'path';

const spawnCalls: unknown[][] = [];
const unrefMock = jest.fn();
const spawnReturnValue = { unref: unrefMock };
let spawnHook: (() => void) | null = null;

jest.mock('child_process', () => ({
  spawn: (...args: unknown[]): { unref: jest.Mock } => {
    spawnCalls.push(args);
    if (spawnHook !== null) {
      spawnHook();
    }
    return spawnReturnValue;
  },
}));

import { ensureProxyRunning } from './ensureProxyRunning';

describe('ensureProxyRunning', () => {
  let server: net.Server | null = null;
  let port = 0;

  const startProbeServer = (): Promise<void> =>
    new Promise((resolve) => {
      server = net.createServer((socket) => socket.end());
      server.listen(0, '127.0.0.1', () => {
        const address = server?.address();
        if (address !== null && typeof address === 'object') {
          port = address.port;
        }
        resolve();
      });
    });

  beforeEach(() => {
    spawnCalls.length = 0;
    spawnHook = null;
    unrefMock.mockReset();
  });

  afterEach(async () => {
    if (server !== null) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = null;
    }
  });

  it('should short-circuit and not spawn when the port already responds', async () => {
    await startProbeServer();
    await ensureProxyRunning(port);
    expect(spawnCalls).toHaveLength(0);
  });

  it('should spawn the proxy detached when the port is unresponsive', async () => {
    const unusedPort = await new Promise<number>((resolve) => {
      const probe = net.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const address = probe.address();
        const portValue =
          address !== null && typeof address === 'object' ? address.port : 0;
        probe.close(() => resolve(portValue));
      });
    });

    await ensureProxyRunning(unusedPort);

    expect(spawnCalls).toHaveLength(1);
    const [program, args, options] = spawnCalls[0];
    expect(program).toBe(process.execPath);
    if (!Array.isArray(args)) {
      throw new Error('Expected spawn args to be an array');
    }
    expect(args).toHaveLength(1);
    const firstArg: unknown = args[0];
    if (typeof firstArg !== 'string') {
      throw new Error('Expected first spawn argument to be a string');
    }
    expect(firstArg.endsWith(path.join('proxy', 'proxyEntry.js'))).toBe(true);
    const isObject = (value: unknown): value is { [key: string]: unknown } =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!isObject(options)) {
      throw new Error('Expected spawn options to be an object');
    }
    expect(options.detached).toBe(true);
    expect(options.stdio).toBe('ignore');
    expect(unrefMock).toHaveBeenCalledTimes(1);
  });

  it('resolves true only when the proxy answers after the call, and false otherwise', async () => {
    const closedPortNumber = async (): Promise<number> =>
      new Promise<number>((resolve) => {
        const probe = net.createServer();
        probe.listen(0, '127.0.0.1', () => {
          const address = probe.address();
          const portValue =
            address !== null && typeof address === 'object' ? address.port : 0;
          probe.close(() => resolve(portValue));
        });
      });

    const cases: {
      name: string;
      setup:
        | 'respondingBeforeCall'
        | 'unresponsiveAfterSpawn'
        | 'respondingAfterSpawn';
      expected: boolean;
      expectedSpawnCount: number;
    }[] = [
      {
        name: 'proxy already responding',
        setup: 'respondingBeforeCall',
        expected: true,
        expectedSpawnCount: 0,
      },
      {
        name: 'proxy still unresponsive after the spawn path',
        setup: 'unresponsiveAfterSpawn',
        expected: false,
        expectedSpawnCount: 1,
      },
      {
        name: 'proxy responding after the spawn path',
        setup: 'respondingAfterSpawn',
        expected: true,
        expectedSpawnCount: 1,
      },
    ];

    for (const testCase of cases) {
      spawnCalls.length = 0;
      spawnHook = null;
      const spawned: { server: net.Server | null } = { server: null };
      let targetPort = 0;

      if (testCase.setup === 'respondingBeforeCall') {
        await startProbeServer();
        targetPort = port;
      } else {
        targetPort = await closedPortNumber();
      }
      if (testCase.setup === 'respondingAfterSpawn') {
        spawnHook = () => {
          const listener = net.createServer((socket) => socket.end());
          spawned.server = listener;
          listener.listen(targetPort, '127.0.0.1');
        };
      }

      const result = await ensureProxyRunning(targetPort);

      expect({
        name: testCase.name,
        result,
        spawnCount: spawnCalls.length,
      }).toEqual({
        name: testCase.name,
        result: testCase.expected,
        spawnCount: testCase.expectedSpawnCount,
      });

      const closing = spawned.server;
      if (closing !== null) {
        await new Promise<void>((resolve) => closing.close(() => resolve()));
      }
    }
  });
});
