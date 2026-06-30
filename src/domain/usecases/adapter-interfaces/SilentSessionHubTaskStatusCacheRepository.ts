import { Issue } from '../../entities/Issue';

export type SilentSessionHubTaskStatusCacheEntry = {
  url: string;
  state: Issue['state'];
  status: string | null;
  recordedEpochSeconds: number;
};

export interface SilentSessionHubTaskStatusCacheRepository {
  loadHubTaskStatus: (params: {
    url: string;
  }) => Promise<SilentSessionHubTaskStatusCacheEntry | null>;
  saveHubTaskStatus: (params: {
    url: string;
    state: Issue['state'];
    status: string | null;
    now: Date;
  }) => Promise<void>;
}
