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

const listEntryNamesOfKind = (
  directory: string,
  isWantedKind: (entry: fs.Dirent) => boolean,
): string[] =>
  fs.existsSync(directory)
    ? fs
        .readdirSync(directory, { withFileTypes: true })
        .filter(isWantedKind)
        .map((entry) => entry.name)
    : [];

const listProjectDirectoryNames = (ownerCallRoot: string): string[] =>
  listEntryNamesOfKind(ownerCallRoot, (entry) => entry.isDirectory());

const listOwnerCallFileNames = (projectPath: string): string[] =>
  listEntryNamesOfKind(projectPath, (entry) => entry.isFile());

const callOfDocument = (value: unknown): PendingOwnerCall => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('sessionName' in value) ||
    typeof value.sessionName !== 'string' ||
    !('calledAt' in value) ||
    typeof value.calledAt !== 'string'
  ) {
    throw new Error('sessionName or calledAt is missing or not a string');
  }
  return { sessionName: value.sessionName, calledAt: value.calledAt };
};

type FileCallsReading = {
  calls: PendingOwnerCall[];
  failures: string[];
};

const readCallsOfFile = (text: string, label: string): FileCallsReading => {
  const calls: PendingOwnerCall[] = [];
  const failures: string[] = [];
  YAML.parseAllDocuments(text).forEach((document, index) => {
    if (document.errors.length > 0) {
      failures.push(
        `${label}: document ${index}: ${document.errors[0].message}`,
      );
      return;
    }
    const value: unknown = document.toJS();
    if (value === null || value === undefined) {
      return;
    }
    try {
      calls.push(callOfDocument(value));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${label}: document ${index}: ${reason}`);
    }
  });
  return { calls, failures };
};

const currentCallPerSession = (
  calls: PendingOwnerCall[],
): PendingOwnerCall[] => {
  const firstCallBySession = new Map<string, PendingOwnerCall>();
  for (const call of calls) {
    if (!firstCallBySession.has(call.sessionName)) {
      firstCallBySession.set(call.sessionName, call);
    }
  }
  return [...firstCallBySession.values()];
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
    for (const projectDirectory of listProjectDirectoryNames(ownerCallRoot)) {
      const projectPath = path.join(ownerCallRoot, projectDirectory);
      for (const fileName of listOwnerCallFileNames(projectPath)) {
        if (!fileName.endsWith(OWNER_CALL_FILE_EXTENSION)) {
          continue;
        }
        const label = `${projectDirectory}/${fileName}`;
        let text: string;
        try {
          text = fs.readFileSync(path.join(projectPath, fileName), 'utf8');
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          failures.push(`${label}: ${reason}`);
          continue;
        }
        const reading = readCallsOfFile(text, label);
        failures.push(...reading.failures);
        calls.push(...currentCallPerSession(reading.calls));
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
