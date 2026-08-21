"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAirplaneSync = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const consoleTabNames_1 = require("./consoleTabNames");
const consoleReadApi_1 = require("./consoleReadApi");
const RAW_CONTENT_SIZE_LIMIT = 512 * 1024;
const fetchRawFileContent = async (rawUrl, ghToken) => {
    try {
        const response = await fetch(rawUrl, {
            headers: { Authorization: `token ${ghToken}` },
        });
        if (!response.ok) {
            return { patch: null, dataUrl: null };
        }
        const contentType = response.headers.get('content-type') ?? '';
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > RAW_CONTENT_SIZE_LIMIT) {
            return { patch: null, dataUrl: null };
        }
        const buffer = Buffer.from(arrayBuffer);
        if (contentType.startsWith('image/')) {
            const base64 = buffer.toString('base64');
            return {
                patch: null,
                dataUrl: `data:${contentType.split(';')[0]};base64,${base64}`,
            };
        }
        if (contentType.startsWith('text/') ||
            contentType.includes('json') ||
            contentType.includes('xml') ||
            !buffer.includes(0)) {
            return { patch: buffer.toString('utf-8'), dataUrl: null };
        }
        return { patch: null, dataUrl: null };
    }
    catch {
        return { patch: null, dataUrl: null };
    }
};
const enrichFilesWithRawContent = async (files, ghToken) => Promise.all(files.map(async (file) => {
    if (file.patch !== null || file.rawUrl === null) {
        return file;
    }
    const result = await fetchRawFileContent(file.rawUrl, ghToken);
    if (result.patch !== null) {
        return { ...file, patch: result.patch };
    }
    if (result.dataUrl !== null) {
        return { ...file, rawUrl: result.dataUrl };
    }
    return file;
}));
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const getString = (value) => typeof value === 'string' ? value : '';
const getNumber = (value) => typeof value === 'number' ? value : 0;
const getBoolean = (value) => value === true;
const parseStringArray = (value) => Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string')
    : [];
const normalizePrFiles = (body) => {
    if (!isRecord(body)) {
        return null;
    }
    if (body.files === null) {
        return null;
    }
    if (!Array.isArray(body.files)) {
        return [];
    }
    return body.files.filter(isRecord).map((file) => ({
        path: getString(file.path) || getString(file.filename),
        additions: getNumber(file.additions),
        deletions: getNumber(file.deletions),
        status: getString(file.status),
        patch: typeof file.patch === 'string' ? file.patch : null,
        rawUrl: typeof file.rawUrl === 'string' ? file.rawUrl : null,
    }));
};
const normalizePrCommits = (body) => {
    if (!isRecord(body) || !Array.isArray(body.commits)) {
        return [];
    }
    return body.commits.filter(isRecord).map((commit) => ({
        sha: getString(commit.sha),
        message: getString(commit.message),
        author: getString(commit.author),
        authoredAt: getString(commit.authoredAt),
    }));
};
const normalizePrStatus = (body) => {
    if (!isRecord(body)) {
        return {
            found: false,
            isConflicted: false,
            mergeableStatus: 'UNKNOWN',
            isPassedAllCiJob: false,
            isCiStateSuccess: false,
            isBranchOutOfDate: false,
            missingRequiredCheckNames: [],
        };
    }
    const found = getBoolean(body.found);
    const status = isRecord(body.status) ? body.status : {};
    return {
        found,
        isConflicted: getBoolean(status.isConflicted),
        mergeableStatus: getString(status.mergeableStatus) || 'UNKNOWN',
        isPassedAllCiJob: getBoolean(status.isPassedAllCiJob),
        isCiStateSuccess: getBoolean(status.isCiStateSuccess),
        isBranchOutOfDate: getBoolean(status.isBranchOutOfDate),
        missingRequiredCheckNames: parseStringArray(status.missingRequiredCheckNames),
    };
};
const normalizeComments = (body) => {
    if (!isRecord(body) || !Array.isArray(body.comments)) {
        return [];
    }
    return body.comments.filter(isRecord).map((comment) => ({
        author: getString(comment.author),
        body: getString(comment.body),
        createdAt: getString(comment.createdAt),
    }));
};
const normalizeState = (body) => {
    if (!isRecord(body)) {
        return { state: 'open', merged: false, isPullRequest: false, title: '' };
    }
    return {
        state: getString(body.state) || 'open',
        merged: getBoolean(body.merged),
        isPullRequest: getBoolean(body.isPullRequest),
        title: getString(body.title),
    };
};
const normalizeRelatedPrs = (body) => {
    if (!isRecord(body) || !Array.isArray(body.relatedPullRequests)) {
        return [];
    }
    return body.relatedPullRequests.filter(isRecord).map((pr) => {
        const summary = isRecord(pr.summary)
            ? {
                title: getString(pr.summary.title),
                body: getString(pr.summary.body),
                additions: getNumber(pr.summary.additions),
                deletions: getNumber(pr.summary.deletions),
                changedFiles: getNumber(pr.summary.changedFiles),
            }
            : null;
        return {
            url: getString(pr.url),
            branchName: typeof pr.branchName === 'string' ? pr.branchName : null,
            createdAt: getString(pr.createdAt),
            isDraft: getBoolean(pr.isDraft),
            isConflicted: getBoolean(pr.isConflicted),
            mergeableStatus: getString(pr.mergeableStatus) ||
                (0, consoleReadApi_1.deriveMergeableStatus)(typeof pr.mergeable === 'string' ? pr.mergeable : null),
            isPassedAllCiJob: getBoolean(pr.isPassedAllCiJob),
            isCiStateSuccess: getBoolean(pr.isCiStateSuccess),
            isResolvedAllReviewComments: getBoolean(pr.isResolvedAllReviewComments),
            isBranchOutOfDate: getBoolean(pr.isBranchOutOfDate),
            missingRequiredCheckNames: parseStringArray(pr.missingRequiredCheckNames),
            summary,
        };
    });
};
const discoverPjcodes = (consoleDataOutputDir) => {
    try {
        const entries = fs.readdirSync(consoleDataOutputDir, {
            withFileTypes: true,
        });
        return entries
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
            .map((entry) => entry.name);
    }
    catch {
        return [];
    }
};
const readTabListJson = (consoleDataOutputDir, pjcode, tab) => {
    const filePath = path.join(consoleDataOutputDir, pjcode, tab, 'list.json');
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) {
            return null;
        }
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
};
const collectUniqueItems = (tabData) => {
    const seen = new Set();
    const items = [];
    for (const pjTabs of Object.values(tabData)) {
        for (const tabPayload of Object.values(pjTabs)) {
            if (!isRecord(tabPayload) || !Array.isArray(tabPayload.items)) {
                continue;
            }
            for (const item of tabPayload.items) {
                if (!isRecord(item) || typeof item.url !== 'string') {
                    continue;
                }
                if (seen.has(item.url)) {
                    continue;
                }
                seen.add(item.url);
                items.push({ url: item.url, isPr: getBoolean(item.isPr) });
            }
        }
    }
    return items;
};
const runWithConcurrency = async (tasks, limit) => {
    let index = 0;
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
        while (index < tasks.length) {
            const current = tasks[index];
            index += 1;
            await current();
        }
    });
    await Promise.all(workers);
};
const SYNC_CONCURRENCY_LIMIT = 5;
const writeSseEvent = (response, event) => {
    response.write(`data: ${JSON.stringify(event)}\n\n`);
};
const handleAirplaneSync = async (response, consoleDataOutputDir, issueRepository, issueTitleStateCache, pullRequestStatusCache, ghToken = null) => {
    response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
    });
    const pjcodes = discoverPjcodes(consoleDataOutputDir);
    const tabData = {};
    for (const pjcode of pjcodes) {
        const pjTabs = {};
        for (const tab of consoleTabNames_1.CONSOLE_LIST_TAB_NAMES) {
            const payload = readTabListJson(consoleDataOutputDir, pjcode, tab);
            if (payload !== null) {
                pjTabs[tab] = payload;
            }
        }
        tabData[pjcode] = pjTabs;
    }
    const uniqueItems = collectUniqueItems(tabData);
    const total = uniqueItems.length;
    let fetched = 0;
    const failures = [];
    const items = {};
    writeSseEvent(response, { type: 'progress', fetched: 0, total });
    const tasks = uniqueItems.map((item) => async () => {
        const { url, isPr } = item;
        try {
            const [bodyResult, commentsResult, stateResult] = await Promise.all([
                (0, consoleReadApi_1.handleItemBody)(issueRepository, url),
                (0, consoleReadApi_1.handleComments)(issueRepository, url),
                (0, consoleReadApi_1.handleIssueTitle)(issueRepository, issueTitleStateCache, url),
            ]);
            let files = null;
            let commits = null;
            let prStatus = null;
            let relatedPrs = null;
            if (isPr) {
                const [filesResult, commitsResult, prStatusResult] = await Promise.all([
                    (0, consoleReadApi_1.handlePrFiles)(issueRepository, url),
                    (0, consoleReadApi_1.handlePrCommits)(issueRepository, url),
                    (0, consoleReadApi_1.handlePullRequestStatus)(issueRepository, pullRequestStatusCache, url),
                ]);
                files = normalizePrFiles(filesResult.body);
                if (files !== null && ghToken !== null) {
                    files = await enrichFilesWithRawContent(files, ghToken);
                }
                commits = normalizePrCommits(commitsResult.body);
                prStatus = normalizePrStatus(prStatusResult.body);
            }
            else {
                const relatedPrsResult = await (0, consoleReadApi_1.handleRelatedPrs)(issueRepository, url);
                relatedPrs = normalizeRelatedPrs(relatedPrsResult.body);
            }
            items[url] = {
                body: isRecord(bodyResult.body) && typeof bodyResult.body.body === 'string'
                    ? bodyResult.body.body
                    : '',
                comments: normalizeComments(commentsResult.body),
                state: normalizeState(stateResult.body),
                files,
                commits,
                prStatus,
                relatedPrs,
            };
        }
        catch {
            failures.push(url);
        }
        fetched += 1;
        writeSseEvent(response, { type: 'progress', fetched, total });
    });
    await runWithConcurrency(tasks, SYNC_CONCURRENCY_LIMIT);
    const snapshot = {
        capturedAt: new Date().toISOString(),
        tabs: tabData,
        items,
        failures,
    };
    writeSseEvent(response, { type: 'done', snapshot });
    response.end();
};
exports.handleAirplaneSync = handleAirplaneSync;
//# sourceMappingURL=consoleAirplaneSnapshotApi.js.map