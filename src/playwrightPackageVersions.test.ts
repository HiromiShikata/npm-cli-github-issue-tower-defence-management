import { readFileSync } from 'fs';
import { join } from 'path';

const PLAYWRIGHT_EXPECTED_VERSION = '1.64.0';

type PlaywrightVersionCase = {
  versionLocation: string;
  manifestFileName: 'package.json' | 'package-lock.json';
  keyPathToVersion: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readManifest = (
  manifestFileName: PlaywrightVersionCase['manifestFileName'],
): Record<string, unknown> => {
  const raw: unknown = JSON.parse(
    readFileSync(join(__dirname, '..', manifestFileName), 'utf8'),
  );
  if (!isRecord(raw)) {
    throw new Error(`${manifestFileName} must contain a JSON object`);
  }
  return raw;
};

const readVersionAtKeyPath = ({
  manifestFileName,
  keyPathToVersion,
}: Pick<
  PlaywrightVersionCase,
  'manifestFileName' | 'keyPathToVersion'
>): string => {
  const versionValue = keyPathToVersion.reduce<unknown>(
    (currentValue, key) => (isRecord(currentValue) ? currentValue[key] : null),
    readManifest(manifestFileName),
  );
  if (typeof versionValue !== 'string') {
    throw new Error(
      `${manifestFileName} has no version string at ${keyPathToVersion.join(' > ')}`,
    );
  }
  return versionValue;
};

describe('playwright package versions', () => {
  const playwrightVersionCases: PlaywrightVersionCase[] = [
    {
      versionLocation: 'package-lock.json resolves @playwright/test',
      manifestFileName: 'package-lock.json',
      keyPathToVersion: [
        'packages',
        'node_modules/@playwright/test',
        'version',
      ],
    },
    {
      versionLocation: 'package-lock.json resolves playwright',
      manifestFileName: 'package-lock.json',
      keyPathToVersion: ['packages', 'node_modules/playwright', 'version'],
    },
    {
      versionLocation: 'package-lock.json resolves playwright-core',
      manifestFileName: 'package-lock.json',
      keyPathToVersion: ['packages', 'node_modules/playwright-core', 'version'],
    },
    {
      versionLocation: 'package.json declares @playwright/test',
      manifestFileName: 'package.json',
      keyPathToVersion: ['devDependencies', '@playwright/test'],
    },
    {
      versionLocation: 'package.json declares playwright',
      manifestFileName: 'package.json',
      keyPathToVersion: ['dependencies', 'playwright'],
    },
  ];

  it('pins @playwright/test, playwright and playwright-core to the same exact version in package.json and package-lock.json', () => {
    const actualVersionsByLocation = playwrightVersionCases.map(
      ({ versionLocation, manifestFileName, keyPathToVersion }) => ({
        versionLocation,
        version: readVersionAtKeyPath({ manifestFileName, keyPathToVersion }),
      }),
    );

    const expectedVersionsByLocation = playwrightVersionCases.map(
      ({ versionLocation }) => ({
        versionLocation,
        version: PLAYWRIGHT_EXPECTED_VERSION,
      }),
    );

    expect(actualVersionsByLocation).toEqual(expectedVersionsByLocation);
  });
});
