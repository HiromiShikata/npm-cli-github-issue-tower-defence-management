const FRAME_LOCATION_PATTERN = /\(?([^()\s]+):\d+:\d+\)?$/;
const MODULE_FILE_EXTENSION_PATTERN = /\.(?:[cm]?[jt]sx?)$/;
const TEST_MODULE_SUFFIX_PATTERN = /\.(?:test|spec)$/;
const NODE_MODULES_SEGMENT = '/node_modules/';

export const CALL_SITE_FRAME_COUNT = 3;
export const CALL_SITE_SEPARATOR = '<-';
export const UNKNOWN_CALL_SITE = 'unknown';

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

const resolveFrameModuleName = (
  frame: string,
  ownPackagePrefix: string | null,
  isInfrastructureModule: (name: string) => boolean,
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
  if (moduleName.length === 0 || isInfrastructureModule(moduleName)) {
    return null;
  }
  return moduleName;
};

export const extractCallSite = (
  stack: string | undefined,
  isInfrastructureModule: (name: string) => boolean,
  modulePath: string,
): string => {
  if (!stack) {
    return UNKNOWN_CALL_SITE;
  }
  const ownPackagePrefix = ownPackagePathPrefix(modulePath);
  const moduleNames = stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .map((frame) =>
      resolveFrameModuleName(frame, ownPackagePrefix, isInfrastructureModule),
    )
    .filter((moduleName): moduleName is string => moduleName !== null)
    .filter(
      (moduleName, index, allModuleNames) =>
        allModuleNames[index - 1] !== moduleName,
    );
  if (moduleNames.length === 0) {
    return UNKNOWN_CALL_SITE;
  }
  return moduleNames.slice(0, CALL_SITE_FRAME_COUNT).join(CALL_SITE_SEPARATOR);
};
