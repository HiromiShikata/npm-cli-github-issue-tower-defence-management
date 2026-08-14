import fs from 'fs';
import path from 'path';
import {
  OWNER_CALL_FILE_DIRECTORY_NAME,
  OwnerCall,
  ownerCallFileRelativePath,
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
