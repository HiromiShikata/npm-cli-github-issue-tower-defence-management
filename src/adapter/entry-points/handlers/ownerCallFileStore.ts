import fs from 'fs';
import path from 'path';
import {
  OWNER_CALL_FILE_DIRECTORY_NAME,
  OwnerCall,
  OwnerCallProjectSessionNames,
  ownerCallFileRelativePath,
  ownerCallProjectCodeOfSession,
  ownerCallYamlDocument,
} from '../../../domain/usecases/intmux/OwnerCallFile';

export type OwnerCallFileAppendParams = {
  dataDir: string;
  projectCode: string | null;
  ownerCall: OwnerCall;
};

export type OwnerCallFileDeleteParams = {
  dataDir: string;
  projectCode: string | null;
  sessionName: string;
};

export type OwnerCallFileDeleteInEveryProjectParams = {
  dataDir: string;
  sessionName: string;
};

export const ownerCallFilePath = (
  dataDir: string,
  projectCode: string | null,
  sessionName: string,
): string =>
  path.join(dataDir, ownerCallFileRelativePath(projectCode, sessionName));

export const ownerCallFileAppend = (
  params: OwnerCallFileAppendParams,
): void => {
  const filePath = ownerCallFilePath(
    params.dataDir,
    params.projectCode,
    params.ownerCall.sessionName,
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, ownerCallYamlDocument(params.ownerCall));
};

export const ownerCallFileDelete = (
  params: OwnerCallFileDeleteParams,
): void => {
  fs.rmSync(
    ownerCallFilePath(params.dataDir, params.projectCode, params.sessionName),
    { force: true },
  );
};

const projectCodeDirectoryNames = (dataDir: string): string[] => {
  const ownerCallDirectory = path.join(dataDir, OWNER_CALL_FILE_DIRECTORY_NAME);
  if (!fs.existsSync(ownerCallDirectory)) {
    return [];
  }
  return fs
    .readdirSync(ownerCallDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
};

export const ownerCallFileDeleteInEveryProject = (
  params: OwnerCallFileDeleteInEveryProjectParams,
): void => {
  for (const projectCode of projectCodeDirectoryNames(params.dataDir)) {
    ownerCallFileDelete({
      dataDir: params.dataDir,
      projectCode,
      sessionName: params.sessionName,
    });
  }
};

// The in-tmux-by-human data the scheduled run writes into the same directory
// serveWeb serves: one `{projectCode}.v4.json` per project, each listing the
// sessions of that project. `index.v4.json` only names the project files, so
// it is not read here.
const IN_TMUX_BY_HUMAN_PROJECT_DATA_SUFFIX = '.v4.json';
const IN_TMUX_BY_HUMAN_INDEX_FILE_NAME = `index${IN_TMUX_BY_HUMAN_PROJECT_DATA_SUFFIX}`;

const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const arrayOrEmpty = (value: unknown): unknown[] =>
  isUnknownArray(value) ? value : [];

const propertyOrUndefined = (value: unknown, key: string): unknown =>
  isRecord(value) ? value[key] : undefined;

const sessionNamesInProjectDataFile = (filePath: string): string[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
  return arrayOrEmpty(propertyOrUndefined(parsed, 'groups')).flatMap((group) =>
    arrayOrEmpty(propertyOrUndefined(group, 'sessions'))
      .map((session) => propertyOrUndefined(session, 'name'))
      .filter((name): name is string => typeof name === 'string'),
  );
};

const inTmuxByHumanProjectSessionNames = (
  dataDir: string,
): OwnerCallProjectSessionNames[] => {
  if (!fs.existsSync(dataDir)) {
    return [];
  }
  return fs
    .readdirSync(dataDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(IN_TMUX_BY_HUMAN_PROJECT_DATA_SUFFIX) &&
        entry.name !== IN_TMUX_BY_HUMAN_INDEX_FILE_NAME,
    )
    .map((entry) => ({
      projectCode: entry.name.slice(
        0,
        entry.name.length - IN_TMUX_BY_HUMAN_PROJECT_DATA_SUFFIX.length,
      ),
      sessionNames: sessionNamesInProjectDataFile(
        path.join(dataDir, entry.name),
      ),
    }));
};

export const ownerCallProjectCodeInInTmuxByHumanData = (
  dataDir: string,
  sessionName: string,
): string | null =>
  ownerCallProjectCodeOfSession(
    inTmuxByHumanProjectSessionNames(dataDir),
    sessionName,
  );
