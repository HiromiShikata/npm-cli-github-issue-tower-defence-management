import { toTmuxSessionName } from '../intmux/InTmuxByHumanSessionReconcileUseCase';

export const LIVE_SESSION_TOOL_OUTPUT_LIMIT_BYTES = 16 * 1024;

export const LIVE_SESSION_TASK_BODY_LIMIT_BYTES = 8 * 1024;

export const LIVE_SESSION_COMMENT_BODY_LIMIT_BYTES = 4 * 1024;

export const LIVE_SESSION_SCREEN_DEFAULT_LINE_COUNT = 80;

export const LIVE_SESSION_SCREEN_MAX_LINE_COUNT = 300;

export const LIVE_SESSION_TOOL_NAMES = {
  callingSessionsList: 'calling_sessions_list',
  sessionScreenRead: 'session_screen_read',
  sessionTaskIssueRead: 'session_task_issue_read',
  sessionFileRead: 'session_file_read',
} as const;

export type LiveSessionToolCallInput = {
  name: string;
  arguments: Record<string, unknown>;
  sessionName: string | null;
};

export type LiveSessionToolCallOutcome =
  | { kind: 'output'; output: string }
  | { kind: 'unknownTool' }
  | { kind: 'invalidArguments' };

export interface LiveSessionToolCallRunner {
  run: (input: LiveSessionToolCallInput) => Promise<LiveSessionToolCallOutcome>;
}

const utf8ByteLength = (text: string): number =>
  new TextEncoder().encode(text).length;

export const capLiveSessionText = (
  text: string,
  limitBytes: number,
): string => {
  if (utf8ByteLength(text) <= limitBytes) {
    return text;
  }
  let kept = '';
  let keptBytes = 0;
  for (const character of text) {
    const characterBytes = utf8ByteLength(character);
    if (keptBytes + characterBytes > limitBytes) {
      break;
    }
    kept += character;
    keptBytes += characterBytes;
  }
  return `${kept}\n[truncated: output longer than ${limitBytes} bytes]`;
};

const SESSION_NAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_/-]*$/;

export const normalizeLiveSessionName = (rawName: string): string | null => {
  const normalized = toTmuxSessionName(rawName.trim());
  return SESSION_NAME_PATTERN.test(normalized) ? normalized : null;
};

const SESSION_NAME_ISSUE_PATTERN =
  /^https_\/\/github_com\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/(issues|pull)\/([0-9]+)$/;

export const issueUrlOfSessionName = (
  sessionName: string,
  knownIssueUrls: readonly string[] = [],
): string | null => {
  const knownUrl = knownIssueUrls.find(
    (issueUrl) => toTmuxSessionName(issueUrl) === sessionName,
  );
  if (knownUrl !== undefined) {
    return knownUrl;
  }
  const match = SESSION_NAME_ISSUE_PATTERN.exec(sessionName);
  if (match === null) {
    return null;
  }
  const [, owner, repo, kind, number] = match;
  if (owner.includes('_') || repo.includes('_')) {
    return null;
  }
  return `https://github.com/${owner}/${repo}/${kind}/${number}`;
};

export const joinSessionFolderPath = (
  folderRealPath: string,
  relativePath: string,
): string => `${folderRealPath.replace(/\/$/, '')}/${relativePath}`;

export const isPathInsideFolder = (
  folderRealPath: string,
  targetRealPath: string,
): boolean => {
  const folder = folderRealPath.replace(/\/+$/, '') || '/';
  const prefix = folder === '/' ? '/' : `${folder}/`;
  return targetRealPath === folder || targetRealPath.startsWith(prefix);
};

export const isBinaryText = (text: string): boolean => text.includes('\u0000');

export const lastScreenLines = (text: string, lineCount: number): string => {
  const lines = text.split('\n');
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === '') {
    end -= 1;
  }
  return lines.slice(Math.max(0, end - lineCount), end).join('\n');
};

const CREDENTIAL_DIRECTORY_PREFIXES = [
  '.ssh',
  '.gnupg',
  '.aws',
  '.azure',
  '.kube',
  '.docker',
];

const CREDENTIAL_FILE_NAMES = [
  '.netrc',
  '.npmrc',
  '.pypirc',
  '.git-credentials',
  '.Xauthority',
  '.ICEauthority',
  '.env',
];

const CREDENTIAL_KEY_FILE_EXTENSIONS = [
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.kdbx',
];

const CREDENTIAL_CONFIG_STEM_NAMES = ['creds', 'credentials', 'secrets'];

const isCredentialComponent = (name: string): boolean =>
  CREDENTIAL_DIRECTORY_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
  CREDENTIAL_FILE_NAMES.includes(name) ||
  name.startsWith('.env.') ||
  (name.startsWith('id_') && !name.slice('id_'.length).includes('.')) ||
  CREDENTIAL_KEY_FILE_EXTENSIONS.some((extension) => name.endsWith(extension));

const isUnderCredentialConfigFolder = (
  components: readonly string[],
): boolean => {
  const configIndex = components.indexOf('.config');
  return (
    configIndex !== -1 &&
    components
      .slice(configIndex + 1)
      .some(
        (name) =>
          name === 'gh' ||
          CREDENTIAL_CONFIG_STEM_NAMES.some(
            (stem) => name === stem || name.startsWith(`${stem}.`),
          ),
      )
  );
};

export const isCredentialLikePath = (components: readonly string[]): boolean =>
  components.some(isCredentialComponent) ||
  isUnderCredentialConfigFolder(components);

export const componentsBelowFolder = (
  folderRealPath: string,
  targetRealPath: string,
): string[] => {
  const folder = folderRealPath.replace(/\/+$/, '');
  if (targetRealPath === folder || targetRealPath === '/') {
    return [];
  }
  const prefix = folder === '' ? '/' : `${folder}/`;
  return targetRealPath
    .slice(prefix.length)
    .split('/')
    .filter((name) => name.length > 0);
};

export const isFolderRefusedForFileRead = (
  folderRealPath: string,
  homeRealPath: string,
): boolean => {
  const folder = folderRealPath.replace(/\/+$/, '') || '/';
  if (folder === '/') {
    return true;
  }
  const home = homeRealPath.replace(/\/+$/, '') || '/';
  return home === folder || home.startsWith(`${folder}/`);
};
