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
exports.ensureProxyRunning = void 0;
const child_process_1 = require("child_process");
const net = __importStar(require("net"));
const path = __importStar(require("path"));
const RateLimitCache_1 = require("./RateLimitCache");
const PROBE_TIMEOUT_MS = 200;
const STARTUP_WAIT_MS = 1500;
const isProxyResponding = (port) => new Promise((resolve) => {
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
const ensureProxyRunning = async (port = RateLimitCache_1.PROXY_PORT) => {
    if (await isProxyResponding(port))
        return;
    const entryPath = path.resolve(__dirname, 'proxyEntry.js');
    const child = (0, child_process_1.spawn)(process.execPath, [entryPath], {
        detached: true,
        stdio: 'ignore',
        env: process.env,
    });
    child.unref();
    await sleep(STARTUP_WAIT_MS);
};
exports.ensureProxyRunning = ensureProxyRunning;
//# sourceMappingURL=ensureProxyRunning.js.map