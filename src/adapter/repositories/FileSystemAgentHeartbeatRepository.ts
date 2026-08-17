import * as fs from 'fs';
import * as path from 'path';
import { AgentHeartbeatRepository } from '../../domain/usecases/adapter-interfaces/AgentHeartbeatRepository';

export const DEFAULT_HEARTBEAT_DIRECTORY = '/tmp/tdpm-agent-heartbeats';

export const toHeartbeatFileName = (issueUrl: string): string =>
  issueUrl.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '-');

export class FileSystemAgentHeartbeatRepository implements AgentHeartbeatRepository {
  constructor(
    private readonly heartbeatDirectory: string = DEFAULT_HEARTBEAT_DIRECTORY,
  ) {}

  readHeartbeatEpochSeconds = async (
    issueUrl: string,
  ): Promise<number | null> => {
    const filePath = path.join(
      this.heartbeatDirectory,
      toHeartbeatFileName(issueUrl),
    );
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return null;
    }
    const parsed = Number(content.trim());
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return parsed;
  };

  writeHeartbeat = async (
    issueUrl: string,
    nowEpochSeconds: number,
  ): Promise<void> => {
    fs.mkdirSync(this.heartbeatDirectory, { recursive: true });
    const filePath = path.join(
      this.heartbeatDirectory,
      toHeartbeatFileName(issueUrl),
    );
    fs.writeFileSync(filePath, String(nowEpochSeconds), 'utf8');
  };
}
