"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeTokenStatus = exports.toTokenRateLimitSnapshot = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const GenerateTokenStatusUseCase_1 = require("../../../domain/usecases/dashboard/GenerateTokenStatusUseCase");
const InTmuxByHumanSessionTokenCountUseCase_1 = require("../../../domain/usecases/InTmuxByHumanSessionTokenCountUseCase");
const RateLimitCache_1 = require("../../proxy/RateLimitCache");
const TokenListLoader_1 = require("../../proxy/TokenListLoader");
const ProcClaudeInteractiveSessionRepository_1 = require("../../repositories/ProcClaudeInteractiveSessionRepository");
const ProcTakeOwnershipSpawnRepository_1 = require("../../repositories/ProcTakeOwnershipSpawnRepository");
const SEVEN_DAY_SONNET_LIMIT_TYPE = 'seven_day_sonnet';
const SEVEN_DAY_OPUS_LIMIT_TYPE = 'seven_day_opus';
const writeJsonAtomic = (filePath, data) => {
    const dir = path_1.default.dirname(filePath);
    fs_1.default.mkdirSync(dir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs_1.default.writeFileSync(tmpPath, JSON.stringify(data));
    fs_1.default.renameSync(tmpPath, filePath);
};
const toTokenRateLimitSnapshot = (snapshot) => {
    if (snapshot === null) {
        return null;
    }
    const hasWindowData = snapshot.unifiedStatus !== null ||
        snapshot.fiveHourReset > 0 ||
        snapshot.sevenDayReset > 0 ||
        snapshot.fiveHourUtilization > 0 ||
        snapshot.sevenDayUtilization > 0;
    return {
        fiveHourUtilization: snapshot.fiveHourUtilization,
        fiveHourReset: snapshot.fiveHourReset,
        sevenDayUtilization: snapshot.sevenDayUtilization,
        sevenDayReset: snapshot.sevenDayReset,
        blocked: snapshot.blocked,
        fiveHourRejected: snapshot.fiveHourRejected,
        sevenDayRejected: snapshot.sevenDayRejected,
        unifiedStatus: snapshot.unifiedStatus,
        sevenDaySonnetRejected: snapshot.modelWeeklyLimits[SEVEN_DAY_SONNET_LIMIT_TYPE]?.rejected ??
            false,
        sevenDayOpusRejected: snapshot.modelWeeklyLimits[SEVEN_DAY_OPUS_LIMIT_TYPE]?.rejected ?? false,
        hasWindowData,
    };
};
exports.toTokenRateLimitSnapshot = toTokenRateLimitSnapshot;
const writeTokenStatus = (params) => {
    const { dashboardDataDir, tokenListJsonPath, issues } = params;
    if (!dashboardDataDir || !tokenListJsonPath) {
        return;
    }
    const entries = (0, TokenListLoader_1.loadTokenEntries)(tokenListJsonPath);
    if (entries === null) {
        return;
    }
    const readSnapshot = params.readSnapshot ?? RateLimitCache_1.readRateLimit;
    const interactiveSessionRepository = params.interactiveSessionRepository ??
        new ProcClaudeInteractiveSessionRepository_1.ProcClaudeInteractiveSessionRepository();
    const spawnRepository = params.spawnRepository ?? new ProcTakeOwnershipSpawnRepository_1.ProcTakeOwnershipSpawnRepository();
    const tokenInputs = entries.map((entry) => ({
        name: entry.name,
        token: entry.token,
        snapshot: (0, exports.toTokenRateLimitSnapshot)(readSnapshot(entry.token)),
    }));
    const distinctLogPathsByToken = new Map();
    for (const spawn of spawnRepository.listSpawns()) {
        const logPaths = distinctLogPathsByToken.get(spawn.token) ?? new Set();
        logPaths.add(spawn.logPath);
        distinctLogPathsByToken.set(spawn.token, logPaths);
    }
    const prepCountByToken = new Map();
    for (const [token, logPaths] of distinctLogPathsByToken.entries()) {
        prepCountByToken.set(token, logPaths.size);
    }
    const candidates = entries.map((entry) => ({
        name: entry.name,
        token: entry.token,
        snapshot: null,
    }));
    const humResult = new InTmuxByHumanSessionTokenCountUseCase_1.InTmuxByHumanSessionTokenCountUseCase().run(candidates, interactiveSessionRepository.listInteractiveSessions(), issues);
    const humCountByToken = new Map(humResult.counts.map((count) => [count.token, count.count]));
    const now = params.now ?? new Date();
    const tokens = new GenerateTokenStatusUseCase_1.GenerateTokenStatusUseCase().run({
        tokens: tokenInputs,
        prepCountByToken,
        humCountByToken,
        nowEpochSeconds: Math.floor(now.getTime() / 1000),
    });
    const file = {
        tokens,
        capturedAt: now.toISOString(),
    };
    writeJsonAtomic(path_1.default.join(dashboardDataDir, 'token-status.json'), file);
};
exports.writeTokenStatus = writeTokenStatus;
//# sourceMappingURL=tokenStatusWriter.js.map