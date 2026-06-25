import * as net from 'net';

const spawnCalls: unknown[][] = [];
const killMock = jest.fn();
const unrefMock = jest.fn();
const spawnReturnValue = { unref: unrefMock, kill: killMock };

jest.mock('child_process', () => ({
  spawn: (...args: unknown[]): { unref: jest.Mock; kill: jest.Mock } => {
    spawnCalls.push(args);
    return spawnReturnValue;
  },
}));

import { ensureConsoleRunning } from './ensureConsoleRunning';

describe('ensureConsoleRunning', () => {
  let server: net.Server | null = null;

  const startProbeServer = (): Promise<number> =>
    new Promise((resolve) => {
      server = net.createServer((socket) => socket.end());
      server.listen(0, '127.0.0.1', () => {
        const address = server?.address();
        const portValue =
          address !== null && typeof address === 'object' ? address.port : 0;
        resolve(portValue);
      });
    });

  const findFreePort = (): Promise<number> =>
    new Promise((resolve) => {
      const probe = net.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const address = probe.address();
        const portValue =
          address !== null && typeof address === 'object' ? address.port : 0;
        probe.close(() => resolve(portValue));
      });
    });

  beforeEach(() => {
    spawnCalls.length = 0;
    unrefMock.mockReset();
    killMock.mockReset();
  });

  afterEach(async () => {
    if (server !== null) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = null;
    }
  });

  it('should short-circuit and return null when the port already responds', async () => {
    const port = await startProbeServer();
    const result = await ensureConsoleRunning('/path/to/config.yaml', port);
    expect(spawnCalls).toHaveLength(0);
    expect(result).toBeNull();
  });

  it('should spawn serveConsole when the port is unresponsive', async () => {
    const unusedPort = await findFreePort();
    await ensureConsoleRunning('/path/to/config.yaml', unusedPort);

    expect(spawnCalls).toHaveLength(1);
    const [program, args, options] = spawnCalls[0];
    expect(program).toBe(process.execPath);
    if (!Array.isArray(args)) {
      throw new Error('Expected spawn args to be an array');
    }
    expect(args[0]).toMatch(/cli\/index\.js$/);
    expect(args[1]).toBe('serveConsole');
    expect(args[2]).toBe('--configFilePath');
    expect(args[3]).toBe('/path/to/config.yaml');
    expect(args[4]).toBe('--port');
    expect(args[5]).toBe(String(unusedPort));
    const isObject = (value: unknown): value is { [key: string]: unknown } =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!isObject(options)) {
      throw new Error('Expected spawn options to be an object');
    }
    expect(options.detached).toBe(true);
    expect(options.stdio).toBe('ignore');
    expect(unrefMock).toHaveBeenCalledTimes(1);
  });

  it('should return an object with a kill method when the port is unresponsive', async () => {
    const unusedPort = await findFreePort();
    const result = await ensureConsoleRunning(
      '/path/to/config.yaml',
      unusedPort,
    );
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('kill');
    expect(typeof result?.kill).toBe('function');
  });
});
