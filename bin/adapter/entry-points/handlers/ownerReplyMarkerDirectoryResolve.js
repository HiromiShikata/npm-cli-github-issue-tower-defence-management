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
exports.ownerReplyMarkerDirectoryResolve = void 0;
const path = __importStar(require("path"));
// The status line writes each session's rendered reply time to
// `<STATUS_LINE_MARKER_ROOT_DIRECTORY>/claude-statusline-call-<uid>/<sessionId>.reply_ts`, and it
// resolves that root without consulting TMPDIR. The silent-session monitor runs from a daemon whose
// TMPDIR points at a separate volume, so resolving the same directory through the operating
// system temporary directory would send the reader to a path the writer never uses and the marker
// would silently never be found. CLAUDE_STATUSLINE_CALL_DIR is the single override both sides honour.
const STATUS_LINE_MARKER_ROOT_DIRECTORY = '/tmp';
const STATUS_LINE_MARKER_DIRECTORY_NAME_PREFIX = 'claude-statusline-call-';
const ownerReplyMarkerDirectoryResolve = (configuredDirectory, environment, userId) => {
    if (configuredDirectory !== null) {
        return configuredDirectory;
    }
    const tdpmEnvironmentDirectory = environment.TDPM_SILENT_OWNER_REPLY_MARKER_DIRECTORY;
    if (tdpmEnvironmentDirectory !== undefined) {
        return tdpmEnvironmentDirectory;
    }
    const statusLineEnvironmentDirectory = environment.CLAUDE_STATUSLINE_CALL_DIR;
    if (statusLineEnvironmentDirectory !== undefined) {
        return statusLineEnvironmentDirectory;
    }
    if (userId === null) {
        return null;
    }
    return path.join(STATUS_LINE_MARKER_ROOT_DIRECTORY, `${STATUS_LINE_MARKER_DIRECTORY_NAME_PREFIX}${userId}`);
};
exports.ownerReplyMarkerDirectoryResolve = ownerReplyMarkerDirectoryResolve;
//# sourceMappingURL=ownerReplyMarkerDirectoryResolve.js.map