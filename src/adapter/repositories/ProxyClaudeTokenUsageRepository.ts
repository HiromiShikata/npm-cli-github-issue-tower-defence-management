import { createHash, randomUUID } from 'crypto';
import { ClaudeTokenUsage } from '../../domain/entities/ClaudeTokenUsage';
import { ClaudeTokenUsageRepository } from '../../domain/usecases/adapter-interfaces/ClaudeTokenUsageRepository';
import { isRecord } from '../../domain/usecases/isRecord';
import { ensureProxyRunning } from '../proxy/ensureProxyRunning';
import { PROXY_PORT, readRateLimit } from '../proxy/RateLimitCache';
import { loadTokenEntries } from '../proxy/TokenListLoader';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { ProcTakeOwnershipWorkerSessionReader } from './ProcTakeOwnershipWorkerSessionReader';

const PROC_DIRECTORY = '/proc';

const TOKEN_RESERVATION_LOCK_FILE_NAME = '.write.lock';

export const TOKEN_LAUNCH_RESERVATION_TTL_MS = 60_000;

interface TokenLaunchReservation {
  reservedAt: number;
}

const isTokenLaunchReservation = (
  value: unknown,
): value is TokenLaunchReservation =>
  isRecord(value) && typeof value.reservedAt === 'number';

export class ProxyClaudeTokenUsageRepository implements ClaudeTokenUsageRepository {
  private readonly workerSessionReader =
    new ProcTakeOwnershipWorkerSessionReader(PROC_DIRECTORY);

  constructor(
    private readonly tokenListJsonPath: string | null,
    private readonly port: number = PROXY_PORT,
    private readonly tokenLaunchReservationCacheRepository: LocalStorageCacheRepository = new LocalStorageCacheRepository(
      new LocalStorageRepository(),
    ),
  ) {}

  ensureObservable = async (): Promise<void> => {
    await ensureProxyRunning(this.port);
  };

  getAvailableTokenUsages = async (): Promise<ClaudeTokenUsage[]> => {
    if (this.tokenListJsonPath === null) {
      return [];
    }
    const entries = loadTokenEntries(this.tokenListJsonPath);
    if (entries === null) {
      return [];
    }
    const nowEpochSeconds = Date.now() / 1000;
    const usages = entries.map(
      ({ name, token, selectionWeight }): ClaudeTokenUsage | null => {
        const snapshot = readRateLimit(token);
        if (snapshot !== null && snapshot.subscriptionDisabled) {
          console.error(
            `Claude subscription access is disabled for token '${name}'; leaving it out of the preparation concurrency allocation.`,
          );
          return null;
        }
        if (snapshot === null) {
          return {
            name,
            token,
            fiveHourUtilization: 0,
            sevenDayUtilization: 0,
            blocked: false,
            rejected: false,
            fiveHourRejected: false,
            modelWeeklyLimits: {},
            blockedUntilEpoch: 0,
            selectionWeight,
          };
        }
        const fiveHourExpired =
          nowEpochSeconds > snapshot.fiveHourReset &&
          snapshot.lastUpdatedEpoch >= snapshot.fiveHourReset;
        const sevenDayExpired =
          nowEpochSeconds > snapshot.sevenDayReset &&
          snapshot.lastUpdatedEpoch >= snapshot.sevenDayReset;
        const fiveHourUtilization = fiveHourExpired
          ? 0
          : snapshot.fiveHourUtilization;
        const sevenDayUtilization = sevenDayExpired
          ? 0
          : snapshot.sevenDayUtilization;
        const fiveHourRejectionActive =
          snapshot.fiveHourRejected && !fiveHourExpired;
        const sevenDayRejectionActive =
          snapshot.sevenDayRejected && !sevenDayExpired;
        const unifiedRejectionActive =
          snapshot.unifiedRejected && !fiveHourExpired;
        const rejected =
          unifiedRejectionActive ||
          fiveHourRejectionActive ||
          sevenDayRejectionActive;
        const modelWeeklyLimits: Record<
          string,
          { rejected: boolean; resetsAt: number }
        > = {};
        for (const [limitType, limit] of Object.entries(
          snapshot.modelWeeklyLimits,
        )) {
          const expired = nowEpochSeconds > limit.resetsAt;
          modelWeeklyLimits[limitType] = {
            rejected: limit.rejected && !expired,
            resetsAt: limit.resetsAt,
          };
        }
        const hasAnySevenDayWeeklyLimit =
          modelWeeklyLimits['seven_day'] !== undefined ||
          modelWeeklyLimits['seven_day_opus'] !== undefined ||
          modelWeeklyLimits['seven_day_sonnet'] !== undefined;
        const needsGenericSevenDayBridge =
          modelWeeklyLimits['seven_day'] === undefined &&
          (!hasAnySevenDayWeeklyLimit || sevenDayRejectionActive);
        if (
          snapshot.sevenDayReset > 0 &&
          !sevenDayExpired &&
          needsGenericSevenDayBridge
        ) {
          modelWeeklyLimits['seven_day'] = {
            rejected: sevenDayRejectionActive,
            resetsAt: snapshot.sevenDayReset,
          };
        }
        const cooldownActive = snapshot.blockedUntilEpoch > nowEpochSeconds;
        return {
          name,
          token,
          fiveHourUtilization,
          sevenDayUtilization,
          blocked: snapshot.blocked,
          rejected,
          fiveHourRejected: fiveHourRejectionActive,
          modelWeeklyLimits,
          blockedUntilEpoch: cooldownActive ? snapshot.blockedUntilEpoch : 0,
          selectionWeight,
        };
      },
    );
    return usages.filter((usage): usage is ClaudeTokenUsage => usage !== null);
  };

  getTokenInFlightCounts = async (): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {};
    for (const session of this.workerSessionReader.listWorkerSessions()) {
      counts[session.sessionToken] = (counts[session.sessionToken] ?? 0) + 1;
    }
    return counts;
  };

  reserveTokenLaunchSlot = async (params: {
    token: string;
    concurrentLimit: number;
  }): Promise<boolean> => {
    const tokenHash = createHash('sha256').update(params.token).digest('hex');
    const reservationDirectoryKey = `token-reservations/${tokenHash}`;
    return this.tokenLaunchReservationCacheRepository.withLock(
      reservationDirectoryKey,
      async (): Promise<boolean> => {
        const reservationDirectoryPath = `${this.tokenLaunchReservationCacheRepository.cachePath}/${reservationDirectoryKey}`;
        const localStorageRepository =
          this.tokenLaunchReservationCacheRepository.localStorageRepository;
        const nowMs = Date.now();
        const reservationFileNames = localStorageRepository
          .listFiles(reservationDirectoryPath)
          .filter((fileName) => fileName !== TOKEN_RESERVATION_LOCK_FILE_NAME);
        let nonExpiredReservationCount = 0;
        for (const fileName of reservationFileNames) {
          const filePath = `${reservationDirectoryPath}/${fileName}`;
          const fileContent = localStorageRepository.readOrNull(filePath);
          if (fileContent === null) {
            continue;
          }
          const parsedFileContent: unknown = JSON.parse(fileContent);
          if (!isTokenLaunchReservation(parsedFileContent)) {
            continue;
          }
          if (
            nowMs - parsedFileContent.reservedAt >
            TOKEN_LAUNCH_RESERVATION_TTL_MS
          ) {
            localStorageRepository.remove(filePath);
            continue;
          }
          nonExpiredReservationCount += 1;
        }
        const realInFlightCounts = await this.getTokenInFlightCounts();
        const realInFlightCount = realInFlightCounts[params.token] ?? 0;
        const combinedCount = realInFlightCount + nonExpiredReservationCount;
        if (combinedCount >= params.concurrentLimit) {
          return false;
        }
        const reservationFilePath = `${reservationDirectoryPath}/${randomUUID()}.json`;
        localStorageRepository.write(
          reservationFilePath,
          JSON.stringify({ reservedAt: nowMs } satisfies TokenLaunchReservation),
        );
        return true;
      },
    );
  };

  proxyBaseUrl = (): string => `http://127.0.0.1:${this.port}`;
}
