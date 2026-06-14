import * as net from 'net';
import * as path from 'path';

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

import { ensureWebConsoleRunning } from './ensureWebConsoleRunning';

describe('ensureWebConsoleRunning', () => {
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
    killMock.mockReset();
  });

  afterEach(async () => {
    if (server !== null) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = null;
    }
  });

  it('should short-circuit and return null when the port already responds', async () => {
    await startProbeServer();
    const result = await ensureWebConsoleRunning('test-access-key', port);
    expect(spawnCalls).toHaveLength(0);
    expect(result).toBeNull();
  });

  it('should spawn the web console detached when the port is unresponsive', async () => {
    const unusedPort = await new Promise<number>((resolve) => {
      const probe = net.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const address = probe.address();
        const portValue =
          address !== null && typeof address === 'object' ? address.port : 0;
        probe.close(() => resolve(portValue));
      });
    });

    await ensureWebConsoleRunning('test-access-key', unusedPort);

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
    expect(firstArg.endsWith(path.join('proxy', 'webConsoleEntry.js'))).toBe(
      true,
    );
    const isObject = (value: unknown): value is { [key: string]: unknown } =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!isObject(options)) {
      throw new Error('Expected spawn options to be an object');
    }
    expect(options.detached).toBe(true);
    expect(options.stdio).toBe('ignore');
    const env = options.env;
    if (!isObject(env)) {
      throw new Error('Expected spawn env to be an object');
    }
    expect(env.WEB_CONSOLE_ACCESS_KEY).toBe('test-access-key');
    expect(env.WEB_CONSOLE_PORT).toBe(String(unusedPort));
    expect(unrefMock).toHaveBeenCalledTimes(1);
  });

  it('should return an object with a kill method when the port is unresponsive', async () => {
    const unusedPort = await new Promise<number>((resolve) => {
      const probe = net.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const address = probe.address();
        const portValue =
          address !== null && typeof address === 'object' ? address.port : 0;
        probe.close(() => resolve(portValue));
      });
    });

    const result = await ensureWebConsoleRunning('test-access-key', unusedPort);

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('kill');
    expect(typeof result?.kill).toBe('function');
  });

  it('should pass the access key and port as environment variables', async () => {
    const unusedPort = await new Promise<number>((resolve) => {
      const probe = net.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const address = probe.address();
        const portValue =
          address !== null && typeof address === 'object' ? address.port : 0;
        probe.close(() => resolve(portValue));
      });
    });

    await ensureWebConsoleRunning('secret-key-456', unusedPort);

    expect(spawnCalls).toHaveLength(1);
    const [, , options] = spawnCalls[0];
    const isObject = (value: unknown): value is { [key: string]: unknown } =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!isObject(options)) {
      throw new Error('Expected spawn options to be an object');
    }
    const env = options.env;
    if (!isObject(env)) {
      throw new Error('Expected spawn env to be an object');
    }
    expect(env.WEB_CONSOLE_ACCESS_KEY).toBe('secret-key-456');
    expect(env.WEB_CONSOLE_PORT).toBe(String(unusedPort));
  });
});
