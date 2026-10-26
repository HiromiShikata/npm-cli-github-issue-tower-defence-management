/**
 * @jest-environment node
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { loadStartPreparationFleetSettings } from './src/adapter/entry-points/cli/fleetConfig';

const readmeText = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');

const nextSectionHeadingPattern = /^#{2,3} /m;

const extractExampleYamlBlockText = (
  markdown: string,
  sectionHeading: string,
): string => {
  const headingIndex = markdown.indexOf(sectionHeading);
  if (headingIndex === -1) {
    throw new Error(
      `Section heading not found in README.md: ${sectionHeading}`,
    );
  }

  const afterHeading = markdown.slice(headingIndex + sectionHeading.length);
  const nextHeadingMatch = afterHeading.match(nextSectionHeadingPattern);
  const sectionBody = nextHeadingMatch
    ? afterHeading.slice(0, nextHeadingMatch.index)
    : afterHeading;

  const exampleLabelIndex = sectionBody.indexOf('Example:');
  if (exampleLabelIndex === -1) {
    throw new Error(
      `"Example:" line not found within section: ${sectionHeading}`,
    );
  }

  const afterExampleLabel = sectionBody.slice(exampleLabelIndex);
  const fencedYamlBlockMatch = afterExampleLabel.match(
    /```yaml\n([\s\S]*?)\n```/,
  );
  if (!fencedYamlBlockMatch) {
    throw new Error(
      `Fenced \`\`\`yaml block not found after "Example:" within section: ${sectionHeading}`,
    );
  }

  return fencedYamlBlockMatch[1];
};

const parseExampleYamlBlock = (
  sectionHeading: string,
): Record<string, unknown> => {
  const yamlBlockText = extractExampleYamlBlockText(readmeText, sectionHeading);
  return YAML.parse(yamlBlockText) as Record<string, unknown>;
};

const extractMapExampleYamlBlockText = (markdown: string): string => {
  const label = 'Example with the map:';
  const lines = markdown.split('\n');
  const labelIndex = lines.findIndex((line) => line === label);
  if (labelIndex === -1) {
    throw new Error(`README.md label not found: ${label}`);
  }

  let openingFenceIndex = labelIndex + 1;
  while (
    openingFenceIndex < lines.length &&
    lines[openingFenceIndex].trim() === ''
  ) {
    openingFenceIndex += 1;
  }
  if (lines[openingFenceIndex] !== '```yaml') {
    throw new Error(`YAML opening fence not found after: ${label}`);
  }

  const closingFenceIndex = lines.findIndex(
    (line, index) => index > openingFenceIndex && line === '```',
  );
  if (closingFenceIndex === -1) {
    throw new Error(`YAML closing fence not found after: ${label}`);
  }

  return lines.slice(openingFenceIndex + 1, closingFenceIndex).join('\n');
};

describe('README.md Example YAML blocks document agentDefinitionsDirectoryPath', () => {
  test.each<{ sectionHeading: string; isNested: boolean }>([
    { sectionHeading: '### Schedule Command Config', isNested: true },
    {
      sectionHeading:
        '### startDaemon and notifyFinishedIssuePreparation Commands Config',
      isNested: false,
    },
  ])(
    'the "$sectionHeading" Example YAML block declares a non-empty agentDefinitionsDirectoryPath, following the awLogDirectoryPath pattern',
    ({ sectionHeading, isNested }) => {
      const parsedExample = parseExampleYamlBlock(sectionHeading);
      const configRoot = isNested
        ? (parsedExample.startPreparation as
            Record<string, unknown> | undefined)
        : parsedExample;

      expect(typeof configRoot?.awLogDirectoryPath).toBe('string');
      expect((configRoot?.awLogDirectoryPath as string).length).toBeGreaterThan(
        0,
      );

      expect(typeof configRoot?.agentDefinitionsDirectoryPath).toBe('string');
      expect(
        (configRoot?.agentDefinitionsDirectoryPath as string).length,
      ).toBeGreaterThan(0);
    },
  );
});

test('README.md llmModelNameByAgentName map example is accepted by the fleet reader', () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'readme-llm-model-map-'),
  );
  const fleetConfigFilePath = path.join(
    temporaryDirectory,
    'fleet-config.yaml',
  );

  try {
    const yamlBlockText = extractMapExampleYamlBlockText(readmeText);
    fs.writeFileSync(fleetConfigFilePath, yamlBlockText);
    const settings = loadStartPreparationFleetSettings(fleetConfigFilePath);
    const modelMap = settings.llmModelNameByAgentName;

    expect(modelMap).not.toBeNull();
    expect(Object.keys(modelMap ?? {}).length).toBeGreaterThan(0);
  } finally {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  }
});

test('README.md llmModelNameByAgentName map deletion reports the missing label', () => {
  const readmeFilePath = path.join(__dirname, 'README.md');
  const originalReadme = fs.readFileSync(readmeFilePath, 'utf8');
  const lines = originalReadme.split('\n');
  const label = 'Example with the map:';
  const labelIndex = lines.findIndex((line) => line === label);
  const openingFenceIndex = lines.findIndex(
    (line, index) => index > labelIndex && line === '```yaml',
  );
  const closingFenceIndex = lines.findIndex(
    (line, index) => index > openingFenceIndex && line === '```',
  );
  const mutatedReadme = [
    ...lines.slice(0, labelIndex),
    ...lines.slice(closingFenceIndex + 1),
  ].join('\n');

  try {
    fs.writeFileSync(readmeFilePath, mutatedReadme);
    const subprocess = spawnSync(
      'npm',
      [
        'run',
        'test',
        '--',
        '--coverage=false',
        '--reporters=default',
        '--runInBand',
        '--runTestsByPath',
        'README.test.ts',
        '--testNamePattern',
        '^README\\.md llmModelNameByAgentName map example is accepted by the fleet reader$',
      ],
      { cwd: __dirname, encoding: 'utf8' },
    );
    const failureOutput = [subprocess.stdout, subprocess.stderr]
      .filter((output): output is string => typeof output === 'string')
      .join('\n');
    const missingLabel =
      /README\.md label not found: (Example with the map:)/.exec(
        failureOutput,
      )?.[1] ?? null;

    expect(missingLabel).toBe('Example with the map:');
  } finally {
    fs.writeFileSync(readmeFilePath, originalReadme);
  }
});
const snapshotRepositoryFiles = (): string => {
  const hashRegularFile = (filePath: string): string => {
    const hash = createHash('sha256');
    const fileDescriptor = fs.openSync(filePath, 'r');
    const buffer = Buffer.allocUnsafe(64 * 1024);

    try {
      let bytesRead = buffer.length;
      while (bytesRead > 0) {
        bytesRead = fs.readSync(fileDescriptor, buffer, 0, buffer.length, null);
        if (bytesRead > 0) {
          hash.update(buffer.subarray(0, bytesRead));
        }
      }
    } finally {
      fs.closeSync(fileDescriptor);
    }

    return hash.digest('hex');
  };

  const snapshotHash = createHash('sha256');
  const directoriesToVisit = [__dirname];
  const rootStat = fs.lstatSync(__dirname);
  snapshotHash.update(
    `${JSON.stringify({
      path: '.',
      type: 'directory',
      permissions: (rootStat.mode & 0o7777).toString(8).padStart(4, '0'),
      symlinkTarget: '',
      digest: '',
    })}\n`,
  );

  while (directoriesToVisit.length > 0) {
    const directoryPath = directoriesToVisit.pop();
    if (directoryPath === undefined) {
      break;
    }

    const directoryEntries = fs
      .readdirSync(directoryPath, { withFileTypes: true })
      .sort((left, right) => (left.name < right.name ? -1 : 1));

    for (const directoryEntry of directoryEntries) {
      const entryPath = path.join(directoryPath, directoryEntry.name);
      const relativePath = path
        .relative(__dirname, entryPath)
        .split(path.sep)
        .join('/');
      if (relativePath.split('/').includes('.git')) {
        continue;
      }

      const entryStat = fs.lstatSync(entryPath);
      const entryType = entryStat.isDirectory()
        ? 'directory'
        : entryStat.isFile()
          ? 'regular'
          : entryStat.isSymbolicLink()
            ? 'symlink'
            : entryStat.isFIFO()
              ? 'fifo'
              : entryStat.isSocket()
                ? 'socket'
                : entryStat.isBlockDevice()
                  ? 'block-device'
                  : entryStat.isCharacterDevice()
                    ? 'character-device'
                    : 'unknown';

      snapshotHash.update(
        `${JSON.stringify({
          path: relativePath,
          type: entryType,
          permissions: (entryStat.mode & 0o7777).toString(8).padStart(4, '0'),
          symlinkTarget: entryStat.isSymbolicLink()
            ? fs.readlinkSync(entryPath)
            : '',
          digest: entryStat.isFile() ? hashRegularFile(entryPath) : '',
        })}\n`,
      );

      if (entryStat.isDirectory()) {
        directoriesToVisit.push(entryPath);
      }
    }
  }

  return snapshotHash.digest('hex');
};

if (process.env.README_TEST_EXISTING_CASES_ONLY !== '1') {
  test('README.md llmModelNameByAgentName test leaves no repository file changes after existing README tests run', () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'readme-working-tree-test-'),
    );
    const jestCacheDirectory = path.join(temporaryDirectory, 'jest-cache');
    const resultFilePath = path.join(temporaryDirectory, 'result.json');

    try {
      const beforeSnapshot = snapshotRepositoryFiles();
      const childResult = spawnSync(
        'npx',
        [
          'jest',
          'README.test.ts',
          '--selectProjects',
          'backend',
          '--coverage=false',
          '--runInBand',
          '--reporters=default',
          `--cacheDirectory=${jestCacheDirectory}`,
          '--json',
          `--outputFile=${resultFilePath}`,
        ],
        {
          cwd: __dirname,
          encoding: 'utf8',
          env: {
            ...process.env,
            README_TEST_EXISTING_CASES_ONLY: '1',
            TMPDIR: temporaryDirectory,
          },
          timeout: 60000,
        },
      );

      if (childResult.error) {
        throw childResult.error;
      }
      if (childResult.status !== 0) {
        throw new Error(childResult.stderr);
      }

      const afterSnapshot = snapshotRepositoryFiles();
      expect(afterSnapshot).toEqual(beforeSnapshot);
    } finally {
      fs.rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });
}

test('README.md llmModelNameByAgentName map example reports its label when the opening fence is deleted', () => {
  const readmeFilePath = path.join(__dirname, 'README.md');
  const originalReadme = fs.readFileSync(readmeFilePath, 'utf8');
  const lines = originalReadme.split('\n');
  const label = 'Example with the map:';
  const labelIndex = lines.findIndex((line) => line === label);
  const openingFenceIndex = lines.findIndex(
    (line, index) => index > labelIndex && line === '```yaml',
  );
  const mutatedReadme = [
    ...lines.slice(0, openingFenceIndex),
    ...lines.slice(openingFenceIndex + 1),
  ].join('\n');

  try {
    fs.writeFileSync(readmeFilePath, mutatedReadme);
    const subprocess = spawnSync(
      'npm',
      [
        'run',
        'test',
        '--',
        '--coverage=false',
        '--reporters=default',
        '--runInBand',
        '--runTestsByPath',
        'README.test.ts',
        '--testNamePattern',
        '^README\\.md llmModelNameByAgentName map example is accepted by the fleet reader$',
      ],
      { cwd: __dirname, encoding: 'utf8' },
    );
    const failureOutput = [subprocess.stdout, subprocess.stderr]
      .filter((output): output is string => typeof output === 'string')
      .join('\n');
    const missingLabel =
      /YAML opening fence not found after: (Example with the map:)/.exec(
        failureOutput,
      )?.[1] ?? null;

    expect(typeof subprocess.status).toBe('number');
    expect(subprocess.status).not.toBe(0);
    expect(missingLabel).toBe('Example with the map:');
  } finally {
    fs.writeFileSync(readmeFilePath, originalReadme);
  }
});
