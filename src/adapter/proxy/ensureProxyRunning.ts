import { spawn } from 'child_process';
import * as net from 'net';
import * as path from 'path';
import { PROXY_PORT } from './RateLimitCache';

const PROBE_TIMEOUT_MS = 200;
const STARTUP_WAIT_MS = 1500;

const isProxyResponding = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    const cleanup = (result: boolean): void => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once('connect', () => cleanup(true));
    socket.once('timeout', () => cleanup(false));
    socket.once('error', () => cleanup(false));
    socket.connect(port, '127.0.0.1');
  });

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const ensureProxyRunning = async (
  port: number = PROXY_PORT,
): Promise<void> => {
  if (await isProxyResponding(port)) return;
  const entryPath = path.resolve(__dirname, 'proxyEntry.js');
  const child = spawn(process.execPath, [entryPath], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
  await sleep(STARTUP_WAIT_MS);
};
