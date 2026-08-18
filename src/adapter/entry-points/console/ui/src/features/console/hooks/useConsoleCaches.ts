import { useMemo } from 'react';
import type { AirplaneSnapshot } from '../lib/airplaneSnapshot';
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

const deriveCacheKey = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length >= 4) {
      const owner = parts[0];
      const repoName = parts[1];
      const number = parts[3];
      return `${owner}/${repoName}#${number}`;
    }
  } catch {}
  return url;
};

const populateCachesFromSnapshot = (
  caches: ConsoleCaches,
  snapshot: AirplaneSnapshot,
): void => {
  for (const [url, item] of Object.entries(snapshot.items)) {
    const key = deriveCacheKey(url);
    caches.body.seed(key, item.body);
    caches.comments.seed(key, item.comments);
    caches.state.seed(key, item.state);
    if (item.files !== null) {
      caches.files.seed(key, item.files);
    }
    if (item.commits !== null) {
      caches.commits.seed(key, item.commits);
    }
    if (item.prStatus !== null) {
      caches.prStatus.seed(key, item.prStatus);
    }
    if (item.relatedPrs !== null) {
      caches.relatedPrs.seed(key, item.relatedPrs);
    }
  }
};

export const useConsoleCaches = (
  airplaneSnapshot: AirplaneSnapshot | null = null,
): ConsoleCaches => {
  return useMemo(() => {
    const client = createConsoleApiClient();
    const caches: ConsoleCaches = {
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
    if (airplaneSnapshot !== null) {
      populateCachesFromSnapshot(caches, airplaneSnapshot);
    }
    return caches;
  }, [airplaneSnapshot]);
};
