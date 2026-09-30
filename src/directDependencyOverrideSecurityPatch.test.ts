import { readFileSync } from 'fs';
import { join } from 'path';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readPackageLockPackages = (): Record<string, unknown> => {
  const raw: unknown = JSON.parse(
    readFileSync(join(__dirname, '..', 'package-lock.json'), 'utf8'),
  );
  if (!isRecord(raw) || !isRecord(raw.packages)) {
    throw new Error('package-lock.json must declare a packages map');
  }
  return raw.packages;
};

const readResolvedVersion = (
  packages: Record<string, unknown>,
  lockfileKey: string,
): string => {
  const entry = packages[lockfileKey];
  if (!isRecord(entry) || typeof entry.version !== 'string') {
    throw new Error(
      `package-lock.json is missing a resolved version for direct dependency override at "${lockfileKey}"`,
    );
  }
  return entry.version;
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

describe('direct dependency override CVE-2026-85024 (GHSA-3wwx-pv8p-q78v) undici patched-version thresholds', () => {
  const directDependencyOverridePatchedVersionThresholds: {
    packageName: string;
    lockfileKey: string;
    requiredMinimumVersion: string;
  }[] = [
    {
      packageName: '@actions/http-client > undici',
      lockfileKey: 'node_modules/@actions/http-client/node_modules/undici',
      requiredMinimumVersion: '6.28.1',
    },
    {
      packageName: 'undici',
      lockfileKey: 'node_modules/undici',
      requiredMinimumVersion: '7.29.1',
    },
  ];

  it('resolves every direct dependency override CVE instance at or above its patched version threshold in package-lock.json', () => {
    const packages = readPackageLockPackages();

    directDependencyOverridePatchedVersionThresholds.forEach(
      ({ lockfileKey, requiredMinimumVersion, packageName }) => {
        const resolvedVersion = readResolvedVersion(packages, lockfileKey);

        if (!isVersionAtLeast(resolvedVersion, requiredMinimumVersion)) {
          throw new Error(
            `${packageName} at "${lockfileKey}" is resolved to ${resolvedVersion}, which is below the required patched minimum ${requiredMinimumVersion}`,
          );
        }

        expect(isVersionAtLeast(resolvedVersion, requiredMinimumVersion)).toBe(
          true,
        );
      },
    );
  });
});
