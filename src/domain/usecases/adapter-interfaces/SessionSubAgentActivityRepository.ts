import { SubAgentActivity } from '../../entities/LiveSessionActivitySnapshot';

export interface SessionSubAgentActivityRepository {
  listSubAgentActivitiesBySessionName: (
    sessionNames: string[],
    transcriptPathBySessionName: Map<string, string>,
  ) => Promise<Map<string, SubAgentActivity[]>>;
}
