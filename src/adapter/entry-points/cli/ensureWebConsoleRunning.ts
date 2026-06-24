import { spawn } from 'child_process';
import * as net from 'net';
import * as path from 'path';

export interface WebConsoleProcess {
  kill: () => void;
}

const PROBE_TIMEOUT_MS = 200;
const STARTUP_WAIT_MS = 1500;

const isPortResponding = (port: number): Promise<boolean> =>
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

export const ensureWebConsoleRunning = async (
  configFilePath: string,
  port: number,
): Promise<WebConsoleProcess | null> => {
  if (await isPortResponding(port)) return null;
  const cliEntry = path.resolve(__dirname, '..', '..', '..', '..', 'index.js');
  const child = spawn(
    process.execPath,
    [
      cliEntry,
      'serveConsole',
      '--configFilePath',
      configFilePath,
      '--port',
      String(port),
    ],
    {
      detached: true,
      stdio: 'ignore',
    },
  );
  child.unref();
  await sleep(STARTUP_WAIT_MS);
  return { kill: () => child.kill() };
};
