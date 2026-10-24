/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

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

const extractMapExampleYamlLines = (markdown: string): string[] => {
  const mapExampleMatch = markdown.match(
    /Example with the map:\n\n(```yaml\n[\s\S]*?\n```)/,
  );
  if (!mapExampleMatch) {
    throw new Error('Map example YAML block not found in README.md');
  }

  return mapExampleMatch[1].split('\n');
};

const requiredLlmModelNameByAgentNameReadmeFragments = [
  '`llmModelNameByAgentName` (mapping of agent name to model name, default unset)',
  'must be a mapping.',
  'must be a non-empty string.',
  'the `llm-model:` label, then `llmModelNameByAgentName`, then the token-routed model, then the agent definition `model:` line, then `defaultLlmModelName`',
] as const;

const requiredMapExampleReadmeLines = [
  '```yaml',
  '  llmModelNameByAgentName:',
] as const;

describe('README.md documents llmModelNameByAgentName', () => {
  test.each(requiredLlmModelNameByAgentNameReadmeFragments)(
    'contains the required documentation fragment: %s',
    (requiredFragment) => {
      expect(readmeText).toContain(requiredFragment);
    },
  );

  test.each(requiredMapExampleReadmeLines)(
    'the map example contains the exact required line: %s',
    (requiredLine) => {
      expect(extractMapExampleYamlLines(readmeText)).toContain(requiredLine);
    },
  );
});

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
