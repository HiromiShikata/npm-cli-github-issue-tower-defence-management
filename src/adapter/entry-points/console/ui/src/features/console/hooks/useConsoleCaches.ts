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
  ConsolePullRequestStatus,
  ConsoleRelatedPullRequest,
} from '../logic/types';

export type ConsoleCaches = {
  body: ResourceCache<string>;
  comments: ResourceCache<ConsoleComment[]>;
  files: ResourceCache<ConsoleChangedFile[]>;
  commits: ResourceCache<ConsoleCommit[]>;
  relatedPrs: ResourceCache<ConsoleRelatedPullRequest[]>;
  state: ResourceCache<ConsoleIssueState>;
  prStatus: ResourceCache<ConsolePullRequestStatus>;
  client: ConsoleApiClient;
};

export const useConsoleCaches = (): ConsoleCaches => {
  return useMemo(() => {
    const client = createConsoleApiClient();
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
      prStatus: new ResourceCache<ConsolePullRequestStatus>(
        client.fetchPullRequestStatus,
      ),
    };
  }, []);
};
