const parseNonNegativeIntegerHeader = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const sanitizeRestPath = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    const questionMark = url.indexOf('?');
    return questionMark === -1 ? url : url.slice(0, questionMark);
  }
};

const REST_CALL_SITE_FRAME_COUNT = 3;
const REST_CALL_SITE_SEPARATOR = '<-';
const UNKNOWN_REST_CALL_SITE = 'unknown';
const REST_INFRASTRUCTURE_MODULES = new Set([
  'githubRestClient',
  'githubRateLimitRetry',
]);

const FRAME_LOCATION_PATTERN = /\(?([^()\s]+):\d+:\d+\)?$/;
const MODULE_FILE_EXTENSION_PATTERN = /\.(?:[cm]?[jt]sx?)$/;
const TEST_MODULE_SUFFIX_PATTERN = /\.(?:test|spec)$/;
const NODE_MODULES_SEGMENT = '/node_modules/';

const ownPackagePathPrefix = (modulePath: string): string | null => {
  const segmentIndex = modulePath.lastIndexOf(NODE_MODULES_SEGMENT);
  if (segmentIndex === -1) {
    return null;
  }
  const packageRootIndex = segmentIndex + NODE_MODULES_SEGMENT.length;
  const segments = modulePath.slice(packageRootIndex).split('/');
  const nameSegmentCount = segments[0].startsWith('@') ? 2 : 1;
  if (segments.length <= nameSegmentCount) {
    return null;
  }
  return modulePath.slice(
    0,
    packageRootIndex + segments.slice(0, nameSegmentCount).join('/').length + 1,
  );
};

const isInsideOwnPackage = (
  location: string,
  ownPackagePrefix: string | null,
): boolean => {
  if (ownPackagePrefix === null || !location.startsWith(ownPackagePrefix)) {
    return false;
  }
  const pathBelowPackageRoot = `/${location.slice(ownPackagePrefix.length)}`;
  return !pathBelowPackageRoot.includes(NODE_MODULES_SEGMENT);
};

const frameModuleName = (
  frame: string,
  ownPackagePrefix: string | null,
): string | null => {
  const match = frame.match(FRAME_LOCATION_PATTERN);
  if (!match) {
    return null;
  }
  const location = match[1];
  if (location.startsWith('node:')) {
    return null;
  }
  if (
    location.includes(NODE_MODULES_SEGMENT) &&
    !isInsideOwnPackage(location, ownPackagePrefix)
  ) {
    return null;
  }
  const fileName = location.split('/').slice(-1)[0];
  const moduleName = fileName
    .replace(MODULE_FILE_EXTENSION_PATTERN, '')
    .replace(TEST_MODULE_SUFFIX_PATTERN, '');
  if (moduleName.length === 0 || REST_INFRASTRUCTURE_MODULES.has(moduleName)) {
    return null;
  }
  return moduleName;
};

export const extractRestCallSite = (
  stack: string | undefined,
  modulePath: string = __filename,
): string => {
  if (!stack) {
    return UNKNOWN_REST_CALL_SITE;
  }
  const ownPackagePrefix = ownPackagePathPrefix(modulePath);
  const moduleNames = stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .map((frame) => frameModuleName(frame, ownPackagePrefix))
    .filter((moduleName): moduleName is string => moduleName !== null)
    .filter(
      (moduleName, index, allModuleNames) =>
        allModuleNames[index - 1] !== moduleName,
    );
  if (moduleNames.length === 0) {
    return UNKNOWN_REST_CALL_SITE;
  }
  return moduleNames
    .slice(0, REST_CALL_SITE_FRAME_COUNT)
    .join(REST_CALL_SITE_SEPARATOR);
};

export const captureRestCallSite = (): string =>
  extractRestCallSite(new Error().stack);

export const logGithubRestRateLimit = (params: {
  headers: Headers;
  method: string;
  path: string;
  caller: string;
  now?: () => Date;
}): void => {
  const remaining = parseNonNegativeIntegerHeader(
    params.headers.get('x-ratelimit-remaining'),
  );
  if (remaining === null) {
    return;
  }
  const now = params.now ?? (() => new Date());
  const used = parseNonNegativeIntegerHeader(
    params.headers.get('x-ratelimit-used'),
  );
  const limit = parseNonNegativeIntegerHeader(
    params.headers.get('x-ratelimit-limit'),
  );
  const resource = params.headers.get('x-ratelimit-resource');
  const resetEpochSeconds = parseNonNegativeIntegerHeader(
    params.headers.get('x-ratelimit-reset'),
  );
  const resetIso =
    resetEpochSeconds !== null
      ? new Date(resetEpochSeconds * 1000).toISOString()
      : null;
  console.log(
    `${now().toISOString()} githubRestClient: method=${params.method} path=${params.path} resource=${resource} used=${used} remaining=${remaining} limit=${limit} reset=${resetIso} caller=${params.caller}`,
  );
};
