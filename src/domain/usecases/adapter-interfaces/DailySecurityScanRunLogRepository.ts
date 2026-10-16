import { DailySecurityScanRunLogEntry } from '../../entities/DailySecurityScanRunLogEntry';

export interface DailySecurityScanRunLogRepository {
  append: (entry: DailySecurityScanRunLogEntry) => Promise<void>;
}
