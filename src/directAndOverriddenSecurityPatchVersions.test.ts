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

const readScriptsPackageLockPackages = (): Record<string, unknown> => {
  const raw: unknown = JSON.parse(
    readFileSync(
      join(__dirname, '..', 'scripts', 'typescript', 'package-lock.json'),
      'utf8',
    ),
  );
  if (!isRecord(raw) || !isRecord(raw.packages)) {
    throw new Error(
      'scripts/typescript/package-lock.json must declare a packages map',
    );
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

const readNestedPackageJsonOverrideVersion = (
  packageName: string,
  nestedPackageName: string,
): string => {
  const raw: unknown = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
  );
  if (!isRecord(raw) || !isRecord(raw.overrides)) {
    throw new Error('package.json must declare an overrides map');
  }
  const packageOverride = raw.overrides[packageName];
  if (!isRecord(packageOverride)) {
    throw new Error(
      `package.json overrides must declare a nested map for "${packageName}"`,
    );
  }
  const overriddenVersion = packageOverride[nestedPackageName];
  if (typeof overriddenVersion !== 'string') {
    throw new Error(
      `package.json overrides must pin "${packageName}.${nestedPackageName}" to a plain version string`,
    );
  }
  return overriddenVersion;
};

const readScriptsPackageJsonOverrides = (): Record<string, unknown> => {
  const raw: unknown = JSON.parse(
    readFileSync(
      join(__dirname, '..', 'scripts', 'typescript', 'package.json'),
      'utf8',
    ),
  );
  if (!isRecord(raw) || !isRecord(raw.overrides)) {
    throw new Error(
      'scripts/typescript/package.json must declare an overrides map',
    );
  }
  return raw.overrides;
};

const readScriptsNestedPackageJsonOverrideVersion = (
  packageName: string,
  nestedPackageName: string,
): string => {
  const packageOverride = readScriptsPackageJsonOverrides()[packageName];
  if (!isRecord(packageOverride)) {
    throw new Error(
      `scripts/typescript/package.json overrides must declare a nested map for "${packageName}"`,
    );
  }
  const overriddenVersion = packageOverride[nestedPackageName];
  if (typeof overriddenVersion !== 'string') {
    throw new Error(
      `scripts/typescript/package.json overrides must pin "${packageName}.${nestedPackageName}" to a plain version string`,
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
      packageName: 'qs',
      lockfileKey: 'node_modules/qs',
      requiredMinimumVersion: '6.16.1',
    },
    {
      packageName: 'glob',
      lockfileKey: 'node_modules/glob',
      requiredMinimumVersion: '14.0.2',
    },
    {
      packageName: 'dompurify',
      lockfileKey: 'node_modules/dompurify',
      requiredMinimumVersion: '3.4.17',
    },
    {
      packageName: 'fast-uri',
      lockfileKey: 'node_modules/fast-uri',
      requiredMinimumVersion: '3.1.9',
    },
    {
      packageName: 'storybook',
      lockfileKey: 'node_modules/storybook',
      requiredMinimumVersion: '10.6.3',
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

  it('resolves scripts/typescript glob consumers at or above their patched version threshold in package-lock.json', () => {
    const packages = readScriptsPackageLockPackages();
    const resolvedVersions = [
      'node_modules/@jest/reporters/node_modules/glob',
      'node_modules/jest-config/node_modules/glob',
      'node_modules/jest-runtime/node_modules/glob',
      'node_modules/test-exclude/node_modules/glob',
    ];

    resolvedVersions.forEach((lockfileKey) => {
      const resolvedVersion = readResolvedVersion(packages, lockfileKey);

      expect(isVersionAtLeast(resolvedVersion, '14.0.2')).toBe(true);
    });
  });

  it('resolves the scripts/typescript rimraf glob dependency below version 8', () => {
    const packages = readScriptsPackageLockPackages();
    const resolvedVersion = readResolvedVersion(
      packages,
      'node_modules/rimraf/node_modules/glob',
    );

    expect(isVersionAtLeast(resolvedVersion, '8.0.0')).toBe(false);
  });

  it('resolves scripts/typescript minimatch consumers at or above their patched version threshold in package-lock.json', () => {
    const packages = readScriptsPackageLockPackages();
    const resolvedVersions: string[] = [
      'node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch',
      'node_modules/test-exclude/node_modules/minimatch',
    ];

    resolvedVersions.forEach((lockfileKey) => {
      const resolvedVersion = readResolvedVersion(packages, lockfileKey);

      expect(isVersionAtLeast(resolvedVersion, '11.0.1')).toBe(true);
    });
  });

  it('pins source-map-js to at or above its patched version threshold via a package.json override', () => {
    const overriddenVersion = readPackageJsonOverrideVersion('source-map-js');

    expect(isVersionAtLeast(overriddenVersion, '1.2.2')).toBe(true);
  });

  it('pins handlebars to at or above its patched version threshold via a package.json override', () => {
    const overriddenVersion = readPackageJsonOverrideVersion('handlebars');

    expect(isVersionAtLeast(overriddenVersion, '4.7.10')).toBe(true);
  });

  it('pins glob to at or above its patched version threshold via a package.json override', () => {
    const overriddenVersion = readPackageJsonOverrideVersion('glob');

    expect(isVersionAtLeast(overriddenVersion, '14.0.2')).toBe(true);
  });

  it('pins scripts/typescript glob consumers to at or above their patched version threshold via nested package.json overrides', () => {
    const packageNames = [
      '@jest/reporters',
      'jest-config',
      'jest-runtime',
      'test-exclude',
    ];

    packageNames.forEach((packageName) => {
      const overriddenVersion = readScriptsNestedPackageJsonOverrideVersion(
        packageName,
        'glob',
      );

      expect(isVersionAtLeast(overriddenVersion, '14.0.2')).toBe(true);
    });
  });

  it('does not declare a plain-string scripts/typescript glob override', () => {
    const globOverride = readScriptsPackageJsonOverrides().glob;

    expect(typeof globOverride).not.toBe('string');
  });

  it('pins the scripts/typescript @typescript-eslint/typescript-estree minimatch override to its patched version threshold', () => {
    const overriddenVersion = readScriptsNestedPackageJsonOverrideVersion(
      '@typescript-eslint/typescript-estree',
      'minimatch',
    );

    expect(isVersionAtLeast(overriddenVersion, '11.0.1')).toBe(true);
  });

  it('pins the scripts/typescript test-exclude minimatch override to its patched version threshold', () => {
    const overriddenVersion = readScriptsNestedPackageJsonOverrideVersion(
      'test-exclude',
      'minimatch',
    );

    expect(isVersionAtLeast(overriddenVersion, '11.0.1')).toBe(true);
  });

  it('pins undici to at or above its patched version threshold via a package.json override', () => {
    const overriddenVersion = readPackageJsonOverrideVersion('undici');

    expect(isVersionAtLeast(overriddenVersion, '7.30.1')).toBe(true);
  });

  it('pins the @actions/http-client undici override to its patched version threshold', () => {
    const overriddenVersion = readNestedPackageJsonOverrideVersion(
      '@actions/http-client',
      'undici',
    );

    expect(isVersionAtLeast(overriddenVersion, '6.29.1')).toBe(true);
  });
});
