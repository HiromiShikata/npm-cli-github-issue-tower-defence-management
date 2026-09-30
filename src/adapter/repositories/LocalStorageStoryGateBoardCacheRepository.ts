import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../../domain/usecases/isRecord';
import {
  BoardCache,
  BoardCacheIssue,
  BoardCacheStoryOption,
  StoryGateBoardCacheRepository,
} from '../../domain/usecases/adapter-interfaces/StoryGateBoardCacheRepository';

export const BOARD_CACHE_DIRECTORY_PREFIX = 'allIssues-';
export const BOARD_CACHE_FILE_NAME = 'latest.json';

const fieldOf = (value: unknown, key: string): unknown =>
  isRecord(value) ? value[key] : undefined;

const stringFieldOf = (value: unknown, key: string): string | null => {
  const field = fieldOf(value, key);
  return typeof field === 'string' ? field : null;
};

const arrayFieldOf = (value: unknown, key: string): unknown[] => {
  const field = fieldOf(value, key);
  return Array.isArray(field) ? field : [];
};

const storyOptionsParse = (story: unknown): BoardCacheStoryOption[] =>
  arrayFieldOf(story, 'stories').flatMap((option) => {
    const id = stringFieldOf(option, 'id');
    const name = stringFieldOf(option, 'name');
    return id !== null && name !== null
      ? [{ id, name, color: stringFieldOf(option, 'color') ?? '' }]
      : [];
  });

const issuesParse = (json: unknown): BoardCacheIssue[] =>
  arrayFieldOf(json, 'issues').flatMap((issue) => {
    const url = stringFieldOf(issue, 'url');
    if (url === null) {
      return [];
    }
    return [
      {
        url,
        story: stringFieldOf(issue, 'story'),
        labels: arrayFieldOf(issue, 'labels').filter(
          (label): label is string => typeof label === 'string',
        ),
        body: stringFieldOf(issue, 'body') ?? '',
        itemId: stringFieldOf(issue, 'itemId') ?? '',
      },
    ];
  });

const storyIssueUrlByOptionNameParse = (
  json: unknown,
): Record<string, string> => {
  const map = fieldOf(json, 'storyIssueUrlByOptionName');
  if (!isRecord(map)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(map).flatMap(([name, url]) =>
      typeof url === 'string' ? [[name, url]] : [],
    ),
  );
};

export class LocalStorageStoryGateBoardCacheRepository implements StoryGateBoardCacheRepository {
  constructor(private readonly cacheBaseDirectory: string) {}

  listBoardCachesNewestFirst = async (): Promise<BoardCache[]> => {
    const caches: BoardCache[] = [];
    for (const filePath of this.boardCacheFilePathsList()) {
      const cache = await this.boardCacheRead(filePath);
      if (cache !== null) {
        caches.push(cache);
      }
    }
    return caches.sort(
      (left, right) => right.modifiedAt.getTime() - left.modifiedAt.getTime(),
    );
  };

  private boardCacheFilePathsList = (): string[] => {
    if (!fs.existsSync(this.cacheBaseDirectory)) {
      return [];
    }
    return fs
      .readdirSync(this.cacheBaseDirectory, { withFileTypes: true })
      .filter((projectEntry) => projectEntry.isDirectory())
      .flatMap((projectEntry) => {
        const projectDirectory = path.join(
          this.cacheBaseDirectory,
          projectEntry.name,
        );
        return fs
          .readdirSync(projectDirectory, { withFileTypes: true })
          .filter(
            (boardEntry) =>
              boardEntry.isDirectory() &&
              boardEntry.name.startsWith(BOARD_CACHE_DIRECTORY_PREFIX),
          )
          .map((boardEntry) =>
            path.join(projectDirectory, boardEntry.name, BOARD_CACHE_FILE_NAME),
          )
          .filter((filePath) => fs.existsSync(filePath));
      });
  };

  private boardCacheRead = async (
    filePath: string,
  ): Promise<BoardCache | null> => {
    try {
      const [stat, content] = await Promise.all([
        fs.promises.stat(filePath),
        fs.promises.readFile(filePath, 'utf8'),
      ]);
      const json: unknown = JSON.parse(content);
      const project = fieldOf(json, 'project');
      const story = fieldOf(project, 'story');
      return {
        filePath,
        modifiedAt: stat.mtime,
        projectId: stringFieldOf(project, 'id') ?? '',
        storyFieldId: stringFieldOf(story, 'fieldId'),
        storyOptions: storyOptionsParse(story),
        storyIssueUrlByOptionName: storyIssueUrlByOptionNameParse(json),
        issues: issuesParse(json),
      };
    } catch (error) {
      console.warn(
        `Skipping unreadable board cache ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  };
}
