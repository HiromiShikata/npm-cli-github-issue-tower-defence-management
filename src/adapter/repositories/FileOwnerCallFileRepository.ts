import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import {
  OWNER_CALL_FILE_DIRECTORY_NAME,
  OWNER_CALL_FILE_EXTENSION,
} from '../../domain/usecases/intmux/OwnerCallFile';
import {
  OwnerCallFileRepository,
  PendingOwnerCall,
} from '../../domain/usecases/adapter-interfaces/LiveSessionToolRepository';

const listEntryNames = (directory: string): string[] =>
  fs.existsSync(directory) ? fs.readdirSync(directory) : [];

const readPendingOwnerCall = (text: string): PendingOwnerCall => {
  const parsed: unknown = YAML.parse(text);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('sessionName' in parsed) ||
    typeof parsed.sessionName !== 'string' ||
    !('calledAt' in parsed) ||
    typeof parsed.calledAt !== 'string'
  ) {
    throw new Error('sessionName or calledAt is missing or not a string');
  }
  return { sessionName: parsed.sessionName, calledAt: parsed.calledAt };
};

export class FileOwnerCallFileRepository implements OwnerCallFileRepository {
  constructor(private readonly dataDir: string) {}

  listPendingOwnerCalls = (): PendingOwnerCall[] => {
    const ownerCallRoot = path.join(
      this.dataDir,
      OWNER_CALL_FILE_DIRECTORY_NAME,
    );
    const calls: PendingOwnerCall[] = [];
    const failures: string[] = [];
    for (const projectDirectory of listEntryNames(ownerCallRoot)) {
      const projectPath = path.join(ownerCallRoot, projectDirectory);
      for (const fileName of listEntryNames(projectPath)) {
        if (!fileName.endsWith(OWNER_CALL_FILE_EXTENSION)) {
          continue;
        }
        try {
          calls.push(
            readPendingOwnerCall(
              fs.readFileSync(path.join(projectPath, fileName), 'utf8'),
            ),
          );
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          failures.push(`${projectDirectory}/${fileName}: ${reason}`);
        }
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `owner call files could not be read: ${failures.join('; ')}`,
      );
    }
    return calls;
  };
}
