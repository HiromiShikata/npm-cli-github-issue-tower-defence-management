import { LiveSessionOutputActivity } from '../../entities/LiveSessionOutputActivity';
export interface SessionOutputActivityRepository {
    listSessionOutputActivities: (sessionNames: string[]) => Promise<LiveSessionOutputActivity[]>;
}
//# sourceMappingURL=SessionOutputActivityRepository.d.ts.map