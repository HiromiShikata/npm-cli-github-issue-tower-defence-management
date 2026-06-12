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
exports.ensurePrReviewViewerRunning = exports.PR_REVIEW_VIEWER_DEFAULT_PORT = void 0;
const child_process_1 = require("child_process");
const net = __importStar(require("net"));
const path = __importStar(require("path"));
exports.PR_REVIEW_VIEWER_DEFAULT_PORT = 3737;
const PROBE_TIMEOUT_MS = 200;
const STARTUP_WAIT_MS = 1500;
const isPortResponding = (port) => new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    const cleanup = (result) => {
        if (resolved)
            return;
        resolved = true;
        socket.destroy();
        resolve(result);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once('connect', () => cleanup(true));
    socket.once('timeout', () => cleanup(false));
    socket.once('error', () => cleanup(false));
    socket.connect(port, '127.0.0.1');
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ensurePrReviewViewerRunning = async (accessKey, port = exports.PR_REVIEW_VIEWER_DEFAULT_PORT) => {
    if (await isPortResponding(port))
        return null;
    const entryPath = path.resolve(__dirname, 'prReviewViewerEntry.js');
    const child = (0, child_process_1.spawn)(process.execPath, [entryPath], {
        detached: true,
        stdio: 'ignore',
        env: {
            ...process.env,
            PR_REVIEW_VIEWER_ACCESS_KEY: accessKey,
            PR_REVIEW_VIEWER_PORT: String(port),
        },
    });
    child.unref();
    await sleep(STARTUP_WAIT_MS);
    return { kill: () => child.kill() };
};
exports.ensurePrReviewViewerRunning = ensurePrReviewViewerRunning;
//# sourceMappingURL=ensurePrReviewViewerRunning.js.map