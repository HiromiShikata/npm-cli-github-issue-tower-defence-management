import { SubAgentActivity } from '../../entities/LiveSessionActivitySnapshot';
export interface SessionSubAgentActivityRepository {
    listSubAgentActivitiesBySessionName: (sessionNames: string[]) => Promise<Map<string, SubAgentActivity[]>>;
}
//# sourceMappingURL=SessionSubAgentActivityRepository.d.ts.map