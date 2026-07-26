import { LiveSessionProcessSnapshot } from '../../entities/LiveSessionProcessSnapshot';

export interface LiveSessionProcessSnapshotProvider {
  getSnapshot: () => Promise<LiveSessionProcessSnapshot>;
}
