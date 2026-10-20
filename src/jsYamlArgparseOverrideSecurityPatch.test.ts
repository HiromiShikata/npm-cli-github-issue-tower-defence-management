import { readFileSync } from 'fs';
import { join } from 'path';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readJsonFile = (fileName: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, '..', fileName), 'utf8'));

const readPackageLockPackages = (): Record<string, unknown> => {
  const raw = readJsonFile('package-lock.json');
  if (!isRecord(raw) || !isRecord(raw.packages)) {
    throw new Error('package-lock.json must declare a packages map');
  }
  return raw.packages;
};

const readLockfileKeysOfPackage = (
  packages: Record<string, unknown>,
  packageName: string,
): string[] => {
  const topLevelLockfileKey = `node_modules/${packageName}`;
  const nestedLockfileKeySuffix = `/node_modules/${packageName}`;
  return Object.keys(packages).filter(
    (lockfileKey) =>
      lockfileKey === topLevelLockfileKey ||
      lockfileKey.endsWith(nestedLockfileKeySuffix),
  );
};

const readResolvedVersion = (
  packages: Record<string, unknown>,
  lockfileKey: string,
): string => {
  const entry = packages[lockfileKey];
  if (!isRecord(entry) || typeof entry.version !== 'string') {
    throw new Error(
      `package-lock.json is missing a resolved version for dependency at "${lockfileKey}"`,
    );
  }
  return entry.version;
};

const readPackageJsonNestedOverrideVersion = (
  parentPackageName: string,
  nestedPackageName: string,
): string => {
  const raw = readJsonFile('package.json');
  if (!isRecord(raw) || !isRecord(raw.overrides)) {
    throw new Error('package.json must declare an overrides map');
  }
  const parentOverride = raw.overrides[parentPackageName];
  if (!isRecord(parentOverride)) {
    throw new Error(
      `package.json overrides must declare "${parentPackageName}" as an object that pins nested packages`,
    );
  }
  const nestedOverriddenVersion = parentOverride[nestedPackageName];
  if (typeof nestedOverriddenVersion !== 'string') {
    throw new Error(
      `package.json overrides for "${parentPackageName}" must pin "${nestedPackageName}" to a plain version string`,
    );
  }
  return nestedOverriddenVersion;
};

const parseNumericVersionTuple = (
  version: string,
): [number, number, number] => {
  const parts = version.split('.');
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error(
      `expected a plain three-part numeric version, got "${version}"`,
    );
  }
  const [major, minor, patch] = parts.map(Number);
  return [major, minor, patch];
};

const isVersionAtLeast = (
  actualVersion: string,
  requiredMinimumVersion: string,
): boolean => {
  const actual = parseNumericVersionTuple(actualVersion);
  const required = parseNumericVersionTuple(requiredMinimumVersion);
  for (let i = 0; i < 3; i += 1) {
    if (actual[i] > required[i]) return true;
    if (actual[i] < required[i]) return false;
  }
  return true;
};

describe('root package.json js-yaml argparse override for CVE-2026-97058 (GHSA-hp3w-g68c-fv3c) sprintf-js', () => {
  const nestedOverridePins: {
    parentPackageName: string;
    nestedPackageName: string;
    expectedVersion: string;
  }[] = [
    {
      parentPackageName: 'js-yaml',
      nestedPackageName: 'argparse',
      expectedVersion: '2.0.1',
    },
  ];

  it('pins argparse beneath js-yaml to exactly 2.0.1 in the package.json overrides', () => {
    nestedOverridePins.forEach(
      ({ parentPackageName, nestedPackageName, expectedVersion }) => {
        expect(
          readPackageJsonNestedOverrideVersion(
            parentPackageName,
            nestedPackageName,
          ),
        ).toBe(expectedVersion);
      },
    );
  });
});

describe('root package-lock.json removal of vulnerable sprintf-js for CVE-2026-97058 (GHSA-hp3w-g68c-fv3c)', () => {
  const removedLockfilePackages: { packageName: string }[] = [
    { packageName: 'sprintf-js' },
  ];

  it('declares no sprintf-js package entry at the top level or nested under any package', () => {
    const packages = readPackageLockPackages();

    removedLockfilePackages.forEach(({ packageName }) => {
      expect(readLockfileKeysOfPackage(packages, packageName)).toEqual([]);
    });
  });
});

describe('root package-lock.json argparse patched-version threshold after the js-yaml override', () => {
  const argparseVersionThresholds: {
    packageName: string;
    requiredMinimumVersion: string;
  }[] = [{ packageName: 'argparse', requiredMinimumVersion: '2.0.1' }];

  it('declares at least one argparse entry and resolves every argparse entry at or above 2.0.1', () => {
    const packages = readPackageLockPackages();

    argparseVersionThresholds.forEach(
      ({ packageName, requiredMinimumVersion }) => {
        const lockfileKeys = readLockfileKeysOfPackage(packages, packageName);
        const entriesBelowRequiredMinimumVersion = lockfileKeys
          .map((lockfileKey) => ({
            lockfileKey,
            resolvedVersion: readResolvedVersion(packages, lockfileKey),
          }))
          .filter(
            ({ resolvedVersion }) =>
              !isVersionAtLeast(resolvedVersion, requiredMinimumVersion),
          );

        expect(lockfileKeys.length).toBeGreaterThan(0);
        expect(entriesBelowRequiredMinimumVersion).toEqual([]);
      },
    );
  });
});
