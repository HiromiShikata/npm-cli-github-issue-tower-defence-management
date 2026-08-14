export const OWNER_CALL_FILE_DIRECTORY_NAME = 'call-to-user';

export const OWNER_CALL_FILE_PROJECT_CODE_FOR_NO_PROJECT = 'NA';

export const OWNER_CALL_FILE_EXTENSION = '.yaml';

export type OwnerCall = {
  sessionName: string;
  calledAt: string;
  body: string;
};

export const ownerCallFileRelativePath = (
  projectCode: string | null,
  sessionName: string,
): string => {
  const directory = projectCode ?? OWNER_CALL_FILE_PROJECT_CODE_FOR_NO_PROJECT;
  const fileName = sessionName.replace(/\//g, '_');
  return `${OWNER_CALL_FILE_DIRECTORY_NAME}/${directory}/${fileName}${OWNER_CALL_FILE_EXTENSION}`;
};

const CALLED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export const isOwnerCallCalledAtValid = (calledAt: string): boolean => {
  if (!CALLED_AT_PATTERN.test(calledAt)) {
    return false;
  }
  const parsed = new Date(calledAt);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().replace(/\.\d{3}Z$/, 'Z') === calledAt
  );
};

const BODY_INDENTATION = '  ';

const bodyBlockLines = (body: string): string[] =>
  body
    .replace(/\n+$/, '')
    .split('\n')
    .map((line) => (line.length === 0 ? '' : `${BODY_INDENTATION}${line}`));

export const ownerCallYamlDocument = (ownerCall: OwnerCall): string =>
  [
    '---',
    `sessionName: ${JSON.stringify(ownerCall.sessionName)}`,
    `calledAt: ${JSON.stringify(ownerCall.calledAt)}`,
    `body: |${BODY_INDENTATION.length}`,
    ...bodyBlockLines(ownerCall.body),
    '',
  ].join('\n');
