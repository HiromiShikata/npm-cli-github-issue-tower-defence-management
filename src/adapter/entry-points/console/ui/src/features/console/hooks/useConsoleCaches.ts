import { useMemo } from 'react';
import {
  type ConsoleApiClient,
  createConsoleApiClient,
} from '../lib/consoleApi';
import { ResourceCache } from '../lib/resourceCache';
import type {
  ConsoleChangedFile,
  ConsoleComment,
  ConsoleCommit,
  ConsoleIssueState,
  ConsoleRelatedPullRequest,
} from '../types';
import { useConsoleToken } from './useConsoleToken';

export type ConsoleCaches = {
  body: ResourceCache<string>;
  comments: ResourceCache<ConsoleComment[]>;
  files: ResourceCache<ConsoleChangedFile[]>;
  commits: ResourceCache<ConsoleCommit[]>;
  relatedPrs: ResourceCache<ConsoleRelatedPullRequest[]>;
  state: ResourceCache<ConsoleIssueState>;
  client: ConsoleApiClient;
};

export const useConsoleCaches = (): ConsoleCaches => {
  const { appendToken } = useConsoleToken();
  return useMemo(() => {
    const client = createConsoleApiClient(appendToken);
    return {
      client,
      body: new ResourceCache<string>(client.fetchItemBody),
      comments: new ResourceCache<ConsoleComment[]>(client.fetchComments),
      files: new ResourceCache<ConsoleChangedFile[]>(client.fetchPrFiles),
      commits: new ResourceCache<ConsoleCommit[]>(client.fetchPrCommits),
      relatedPrs: new ResourceCache<ConsoleRelatedPullRequest[]>(
        client.fetchRelatedPrs,
      ),
      state: new ResourceCache<ConsoleIssueState>(client.fetchIssueState),
    };
  }, [appendToken]);
};
