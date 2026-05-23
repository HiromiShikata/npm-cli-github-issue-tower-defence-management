import * as net from 'net';
import * as path from 'path';

const spawnCalls: unknown[][] = [];
const unrefMock = jest.fn();
const spawnReturnValue = { unref: unrefMock };

jest.mock('child_process', () => ({
  spawn: (...args: unknown[]): { unref: jest.Mock } => {
    spawnCalls.push(args);
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
    const isObject = (
      value: unknown,
    ): value is { [key: string]: unknown } =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!isObject(options)) {
      throw new Error('Expected spawn options to be an object');
    }
    expect(options.detached).toBe(true);
    expect(options.stdio).toBe('ignore');
    expect(unrefMock).toHaveBeenCalledTimes(1);
  });
});
