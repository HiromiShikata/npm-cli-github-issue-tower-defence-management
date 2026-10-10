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
      `package-lock.json is missing a resolved version for dependency at "${lockfileKey}"`,
    );
  }
  return entry.version;
};

const readPackageJsonOverrideVersion = (packageName: string): string => {
  const raw: unknown = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
  );
  if (!isRecord(raw) || !isRecord(raw.overrides)) {
    throw new Error('package.json must declare an overrides map');
  }
  const overriddenVersion = raw.overrides[packageName];
  if (typeof overriddenVersion !== 'string') {
    throw new Error(
      `package.json overrides must pin "${packageName}" to a plain version string`,
    );
  }
  return overriddenVersion;
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

describe('direct and overridden dependency patched-version thresholds', () => {
  const patchedVersionThresholds: {
    packageName: string;
    lockfileKey: string;
    requiredMinimumVersion: string;
  }[] = [
    {
      packageName: 'dompurify',
      lockfileKey: 'node_modules/dompurify',
      requiredMinimumVersion: '3.4.16',
    },
    {
      packageName: 'brace-expansion',
      lockfileKey: 'node_modules/brace-expansion',
      requiredMinimumVersion: '5.0.12',
    },
    {
      packageName: 'source-map-js',
      lockfileKey: 'node_modules/source-map-js',
      requiredMinimumVersion: '1.2.2',
    },
    {
      packageName: 'handlebars',
      lockfileKey: 'node_modules/handlebars',
      requiredMinimumVersion: '4.7.10',
    },
  ];

  it('resolves every direct and overridden CVE dependency at or above its patched version threshold in package-lock.json', () => {
    const packages = readPackageLockPackages();

    patchedVersionThresholds.forEach(
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

  it('pins source-map-js to at or above its patched version threshold via a package.json override', () => {
    const overriddenVersion = readPackageJsonOverrideVersion('source-map-js');

    expect(isVersionAtLeast(overriddenVersion, '1.2.2')).toBe(true);
  });

  it('pins handlebars to at or above its patched version threshold via a package.json override', () => {
    const overriddenVersion = readPackageJsonOverrideVersion('handlebars');

    expect(isVersionAtLeast(overriddenVersion, '4.7.10')).toBe(true);
  });
});
