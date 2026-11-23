import * as fs from 'fs';
import * as path from 'path';
import { KnownIssueUrlRepository } from '../../domain/usecases/adapter-interfaces/LiveSessionToolRepository';

const PROJECT_DATA_SUFFIX = '.v4.json';
const INDEX_FILE_NAME = `index${PROJECT_DATA_SUFFIX}`;

const readIssueUrlsOfProjectFile = (filePath: string): string[] => {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('groups' in parsed) ||
    !Array.isArray(parsed.groups)
  ) {
    throw new Error('in-tmux project data has no groups list');
  }
  return parsed.groups.flatMap((group: unknown) => {
    if (
      typeof group !== 'object' ||
      group === null ||
      !('sessions' in group) ||
      !Array.isArray(group.sessions)
    ) {
      return [];
    }
    return group.sessions.flatMap((session: unknown) =>
      typeof session === 'object' &&
      session !== null &&
      'name' in session &&
      typeof session.name === 'string'
        ? [session.name]
        : [],
    );
  });
};

export class FileInTmuxIssueUrlRepository implements KnownIssueUrlRepository {
  constructor(private readonly dataDir: string) {}

  listKnownIssueUrls = (): string[] => {
    if (!fs.existsSync(this.dataDir)) {
      return [];
    }
    const failures: string[] = [];
    const urls: string[] = [];
    for (const entry of fs.readdirSync(this.dataDir, { withFileTypes: true })) {
      if (
        !entry.isFile() ||
        !entry.name.endsWith(PROJECT_DATA_SUFFIX) ||
        entry.name === INDEX_FILE_NAME
      ) {
        continue;
      }
      try {
        urls.push(
          ...readIssueUrlsOfProjectFile(path.join(this.dataDir, entry.name)),
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push(`${entry.name}: ${reason}`);
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `in-tmux project data could not be read: ${failures.join('; ')}`,
      );
    }
    return urls;
  };
}
