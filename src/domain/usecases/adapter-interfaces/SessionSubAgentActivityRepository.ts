import { SubAgentActivity } from '../../entities/LiveSessionActivitySnapshot';

export interface SessionSubAgentActivityRepository {
  listSubAgentActivitiesBySessionName: (
    sessionNames: string[],
  ) => Promise<Map<string, SubAgentActivity[]>>;
}
