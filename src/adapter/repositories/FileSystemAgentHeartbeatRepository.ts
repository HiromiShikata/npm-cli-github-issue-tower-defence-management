import * as fs from 'fs';
import * as path from 'path';
import { AgentHeartbeatRepository } from '../../domain/usecases/adapter-interfaces/AgentHeartbeatRepository';

export const DEFAULT_HEARTBEAT_DIRECTORY = '/tmp/tdpm-agent-heartbeats';
const ORPHAN_CANDIDATE_SUBDIR = 'orphan-candidates';

export const toHeartbeatFileName = (issueUrl: string): string =>
  issueUrl.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '-');

const readEpochFromFile = (filePath: string): number | null => {
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

const writeEpochToFile = (filePath: string, epochSeconds: number): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, String(epochSeconds), 'utf8');
};

export class FileSystemAgentHeartbeatRepository implements AgentHeartbeatRepository {
  constructor(
    private readonly heartbeatDirectory: string = DEFAULT_HEARTBEAT_DIRECTORY,
  ) {}

  private get orphanCandidateDirectory(): string {
    return path.join(this.heartbeatDirectory, ORPHAN_CANDIDATE_SUBDIR);
  }

  readHeartbeatEpochSeconds = async (
    issueUrl: string,
  ): Promise<number | null> => {
    return readEpochFromFile(
      path.join(this.heartbeatDirectory, toHeartbeatFileName(issueUrl)),
    );
  };

  writeHeartbeat = async (
    issueUrl: string,
    nowEpochSeconds: number,
  ): Promise<void> => {
    writeEpochToFile(
      path.join(this.heartbeatDirectory, toHeartbeatFileName(issueUrl)),
      nowEpochSeconds,
    );
  };

  readOrphanCandidateEpochSeconds = async (
    issueUrl: string,
  ): Promise<number | null> => {
    return readEpochFromFile(
      path.join(this.orphanCandidateDirectory, toHeartbeatFileName(issueUrl)),
    );
  };

  writeOrphanCandidate = async (
    issueUrl: string,
    nowEpochSeconds: number,
  ): Promise<void> => {
    writeEpochToFile(
      path.join(this.orphanCandidateDirectory, toHeartbeatFileName(issueUrl)),
      nowEpochSeconds,
    );
  };

  deleteOrphanCandidate = async (issueUrl: string): Promise<void> => {
    const filePath = path.join(
      this.orphanCandidateDirectory,
      toHeartbeatFileName(issueUrl),
    );
    try {
      fs.unlinkSync(filePath);
    } catch {
      // File may not exist; that is fine.
    }
  };
}
