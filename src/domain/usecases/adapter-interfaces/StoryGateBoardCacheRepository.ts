export type BoardCacheStoryOption = {
  id: string;
  name: string;
  color: string;
};

export type BoardCacheIssue = {
  url: string;
  story: string | null;
  labels: string[];
  body: string;
  itemId: string;
};

export type BoardCache = {
  filePath: string;
  modifiedAt: Date;
  projectId: string;
  storyFieldId: string | null;
  storyOptions: BoardCacheStoryOption[];
  storyIssueUrlByOptionName: Record<string, string>;
  issues: BoardCacheIssue[];
};

export interface StoryGateBoardCacheRepository {
  listBoardCachesNewestFirst(): Promise<BoardCache[]>;
}
