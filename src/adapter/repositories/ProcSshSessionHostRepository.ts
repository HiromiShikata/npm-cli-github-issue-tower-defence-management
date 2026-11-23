import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import {
  SessionHost,
  SessionHostRepository,
} from '../../domain/usecases/adapter-interfaces/LiveSessionToolRepository';

const DEFAULT_PROC_DIRECTORY = '/proc';
const SSH_PROGRAM_NAME = 'ssh';
const REMOTE_LIVE_SESSION_KEY_NAME = 'TDPM_REMOTE_LIVE_SESSION_KEY';
const UNIDENTIFIED_REMOTE_HOST_NAME = 'unidentified';
const HOST_FIELD_PATTERN = /^[A-Za-z0-9._-]+$/;

type WorkerHostEntry = {
  name: string;
  address: string;
  port: number;
  user: string;
};

const readWorkerHostEntry = (value: unknown): WorkerHostEntry => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('name' in value) ||
    !('address' in value) ||
    !('port' in value) ||
    !('user' in value) ||
    typeof value.name !== 'string' ||
    typeof value.address !== 'string' ||
    typeof value.port !== 'number' ||
    typeof value.user !== 'string' ||
    !HOST_FIELD_PATTERN.test(value.name) ||
    !HOST_FIELD_PATTERN.test(value.address) ||
    !HOST_FIELD_PATTERN.test(value.user) ||
    !Number.isInteger(value.port)
  ) {
    throw new Error(
      'worker host entry has an invalid name, address, port or user',
    );
  }
  return {
    name: value.name,
    address: value.address,
    port: value.port,
    user: value.user,
  };
};

const readWorkerHosts = (filePath: string | null): WorkerHostEntry[] => {
  if (filePath === null || !fs.existsSync(filePath)) {
    return [];
  }
  const parsed: unknown = YAML.parse(fs.readFileSync(filePath, 'utf8'));
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('hosts' in parsed) ||
    !Array.isArray(parsed.hosts)
  ) {
    throw new Error('worker host table has no hosts list');
  }
  return parsed.hosts.map(readWorkerHostEntry);
};

const readProcFile = (
  procDirectory: string,
  processId: string,
  fileName: string,
): string | null => {
  try {
    return fs.readFileSync(
      path.join(procDirectory, processId, fileName),
      'utf8',
    );
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : null;
    if (code === 'ENOENT' || code === 'EACCES') {
      return null;
    }
    throw error;
  }
};

const readArguments = (cmdline: string): string[] =>
  cmdline.split('\u0000').filter((argument) => argument.length > 0);

const readEnvironmentValue = (environ: string, name: string): string | null => {
  const prefix = `${name}=`;
  const entry = environ
    .split('\u0000')
    .find((candidate) => candidate.startsWith(prefix));
  return entry === undefined ? null : entry.slice(prefix.length);
};

export class ProcSshSessionHostRepository implements SessionHostRepository {
  constructor(
    private readonly workerHostsFilePath: string | null,
    private readonly procDirectory: string = DEFAULT_PROC_DIRECTORY,
  ) {}

  findHostOfIssueSession = (issueUrl: string): SessionHost => {
    const launchingProcessId = this.findRemoteLaunchProcessId(issueUrl);
    if (launchingProcessId === null) {
      return { kind: 'local' };
    }
    const environ = readProcFile(
      this.procDirectory,
      launchingProcessId,
      'environ',
    );
    const liveSessionKey =
      environ === null
        ? null
        : readEnvironmentValue(environ, REMOTE_LIVE_SESSION_KEY_NAME);
    const hostName =
      liveSessionKey === null
        ? UNIDENTIFIED_REMOTE_HOST_NAME
        : liveSessionKey.split(':')[0];
    const entry = readWorkerHosts(this.workerHostsFilePath).find(
      (candidate) => candidate.name === hostName,
    );
    if (entry === undefined) {
      return { kind: 'unknownRemote', name: hostName };
    }
    return {
      kind: 'remote',
      name: entry.name,
      address: entry.address,
      port: entry.port,
      user: entry.user,
    };
  };

  private findRemoteLaunchProcessId = (issueUrl: string): string | null => {
    const marker = `Take ownership of ${issueUrl}"`;
    const processIds = fs
      .readdirSync(this.procDirectory)
      .filter((entry) => /^\d+$/.test(entry));
    for (const processId of processIds) {
      const cmdline = readProcFile(this.procDirectory, processId, 'cmdline');
      if (cmdline === null) {
        continue;
      }
      const argumentsOfProcess = readArguments(cmdline);
      const [program] = argumentsOfProcess;
      if (
        program !== undefined &&
        path.basename(program) === SSH_PROGRAM_NAME &&
        argumentsOfProcess.some((argument) => argument.includes(marker))
      ) {
        return processId;
      }
    }
    return null;
  };
}
