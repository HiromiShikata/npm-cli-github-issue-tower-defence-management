"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTriagerAgentName = exports.TRIAGER_AGENT_NAME = void 0;
exports.TRIAGER_AGENT_NAME = 'triager';
const isTriagerAgentName = (agentName) => agentName !== null && agentName.trim().toLowerCase() === exports.TRIAGER_AGENT_NAME;
exports.isTriagerAgentName = isTriagerAgentName;
//# sourceMappingURL=triagerAgentName.js.map