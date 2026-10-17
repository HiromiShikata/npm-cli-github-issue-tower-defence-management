import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import YAML from 'yaml';
import type { AgentDefinitionRepository } from '../../domain/usecases/adapter-interfaces/AgentDefinitionRepository';
import { isRecord } from '../../domain/usecases/isRecord';

const FRONTMATTER_DELIMITER_LINE = '---';

const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const resolveAgentDefinitionsDirectoryPath = (
  configuredPath?: string | null,
): string =>
  typeof configuredPath === 'string' && configuredPath.length > 0
    ? configuredPath
    : path.join(os.homedir(), '.claude', 'agents');

export class FileSystemAgentDefinitionRepository implements AgentDefinitionRepository {
  constructor(private readonly agentDefinitionsDirectoryPath: string) {}

  getLlmModelName = async (agentName: string): Promise<string | null> => {
    const agentDefinitionFilePath = path.join(
      this.agentDefinitionsDirectoryPath,
      `${agentName}.md`,
    );
    let fileContent: string;
    try {
      fileContent = await fs.promises.readFile(agentDefinitionFilePath, 'utf8');
    } catch (error) {
      console.warn(
        `FileSystemAgentDefinitionRepository: cannot read the agent definition file ${agentDefinitionFilePath}: ${errorMessageOf(error)}`,
      );
      return null;
    }
    const frontmatterText = this.extractFrontmatterText(fileContent);
    if (frontmatterText === null) {
      console.warn(
        `FileSystemAgentDefinitionRepository: ${agentDefinitionFilePath} has no YAML frontmatter block delimited by ${FRONTMATTER_DELIMITER_LINE} lines`,
      );
      return null;
    }
    let parsedFrontmatter: unknown;
    try {
      parsedFrontmatter = YAML.parse(frontmatterText);
    } catch (error) {
      console.warn(
        `FileSystemAgentDefinitionRepository: failed to parse YAML frontmatter of ${agentDefinitionFilePath}: ${errorMessageOf(error)}`,
      );
      return null;
    }
    if (!isRecord(parsedFrontmatter)) {
      console.warn(
        `FileSystemAgentDefinitionRepository: YAML frontmatter of ${agentDefinitionFilePath} is not a mapping`,
      );
      return null;
    }
    const modelFieldValue = parsedFrontmatter['model'];
    if (typeof modelFieldValue !== 'string') {
      return null;
    }
    return modelFieldValue;
  };

  private extractFrontmatterText = (fileContent: string): string | null => {
    const lines = fileContent.split('\n');
    if (lines[0]?.trim() !== FRONTMATTER_DELIMITER_LINE) {
      return null;
    }
    const closingDelimiterLineIndex = lines
      .slice(1)
      .findIndex((line) => line.trim() === FRONTMATTER_DELIMITER_LINE);
    if (closingDelimiterLineIndex === -1) {
      return null;
    }
    return lines.slice(1, closingDelimiterLineIndex + 1).join('\n');
  };
}
