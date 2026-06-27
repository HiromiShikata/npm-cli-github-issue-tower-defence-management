"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeTokenStatus = exports.toTokenRateLimitSnapshot = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const WorkflowStatus_1 = require("../../../domain/entities/WorkflowStatus");
const GenerateTokenStatusUseCase_1 = require("../../../domain/usecases/dashboard/GenerateTokenStatusUseCase");
const InTmuxByHumanSessionTokenCountUseCase_1 = require("../../../domain/usecases/InTmuxByHumanSessionTokenCountUseCase");
const RateLimitCache_1 = require("../../proxy/RateLimitCache");
const TokenListLoader_1 = require("../../proxy/TokenListLoader");
const ProcClaudeInteractiveSessionRepository_1 = require("../../repositories/ProcClaudeInteractiveSessionRepository");
const ProcTakeOwnershipSpawnRepository_1 = require("../../repositories/ProcTakeOwnershipSpawnRepository");
const SEVEN_DAY_SONNET_LIMIT_TYPE = 'seven_day_sonnet';
const SEVEN_DAY_OPUS_LIMIT_TYPE = 'seven_day_opus';
const IN_TMUX_PROJECTS_DIR_NAME = 'token-status-in-tmux';
const writeJsonAtomic = (filePath, data) => {
    const dir = path_1.default.dirname(filePath);
    fs_1.default.mkdirSync(dir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs_1.default.writeFileSync(tmpPath, JSON.stringify(data));
    fs_1.default.renameSync(tmpPath, filePath);
};
const inTmuxByHumanUrlsFromIssues = (issues) => {
    const urls = new Set();
    for (const issue of issues) {
        if (issue.status === WorkflowStatus_1.IN_TMUX_STATUS_NAME && issue.isClosed === false) {
            urls.add(issue.url);
        }
    }
    return [...urls];
};
const persistProjectInTmuxByHumanUrls = (inTmuxProjectsDir, pjcode, urls, capturedAt) => {
    const file = { pjcode, urls, capturedAt };
    writeJsonAtomic(path_1.default.join(inTmuxProjectsDir, `${pjcode}.json`), file);
};
const readMachineWideInTmuxByHumanUrls = (inTmuxProjectsDir) => {
    const urls = new Set();
    let fileNames;
    try {
        fileNames = fs_1.default.readdirSync(inTmuxProjectsDir);
    }
    catch {
        return urls;
    }
    for (const fileName of fileNames) {
        if (!fileName.endsWith('.json')) {
            continue;
        }
        try {
            const parsed = JSON.parse(fs_1.default.readFileSync(path_1.default.join(inTmuxProjectsDir, fileName), 'utf8'));
            if (parsed === null ||
                typeof parsed !== 'object' ||
                !('urls' in parsed) ||
                !Array.isArray(parsed.urls)) {
                continue;
            }
            for (const url of parsed.urls) {
                if (typeof url === 'string') {
                    urls.add(url);
                }
            }
        }
        catch {
            continue;
        }
    }
    return urls;
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
    const { dashboardDataDir, tokenListJsonPath, issues, pjcode } = params;
    if (!dashboardDataDir || !tokenListJsonPath) {
        return;
    }
    const entries = (0, TokenListLoader_1.loadTokenEntries)(tokenListJsonPath);
    if (entries === null) {
        return;
    }
    const now = params.now ?? new Date();
    const inTmuxProjectsDir = path_1.default.join(dashboardDataDir, IN_TMUX_PROJECTS_DIR_NAME);
    if (pjcode) {
        persistProjectInTmuxByHumanUrls(inTmuxProjectsDir, pjcode, inTmuxByHumanUrlsFromIssues(issues), now.toISOString());
    }
    const machineWideInTmuxByHumanUrls = pjcode
        ? readMachineWideInTmuxByHumanUrls(inTmuxProjectsDir)
        : new Set(inTmuxByHumanUrlsFromIssues(issues));
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
        subscriptionDisabled: false,
        unifiedRejected: false,
    }));
    const machineWideInTmuxByHumanIssues = [
        ...machineWideInTmuxByHumanUrls,
    ].map((url) => ({
        nameWithOwner: '',
        number: 0,
        title: '',
        state: 'OPEN',
        status: WorkflowStatus_1.IN_TMUX_STATUS_NAME,
        story: null,
        nextActionDate: null,
        nextActionHour: null,
        estimationMinutes: null,
        dependedIssueUrls: [],
        completionDate50PercentConfidence: null,
        url,
        assignees: [],
        labels: [],
        org: '',
        repo: '',
        body: '',
        itemId: '',
        isPr: false,
        isInProgress: false,
        isClosed: false,
        createdAt: now,
        author: '',
        closingIssueReferenceUrls: [],
    }));
    const humResult = new InTmuxByHumanSessionTokenCountUseCase_1.InTmuxByHumanSessionTokenCountUseCase().run(candidates, interactiveSessionRepository.listInteractiveSessions(), machineWideInTmuxByHumanIssues);
    const humCountByToken = new Map(humResult.counts.map((count) => [count.token, count.count]));
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