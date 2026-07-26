import { LiveSessionOutputActivity } from '../../entities/LiveSessionOutputActivity';

export interface SessionOutputActivityRepository {
  listSessionOutputActivities: (
    transcriptPathBySessionName: Map<string, string>,
  ) => Promise<LiveSessionOutputActivity[]>;
}
