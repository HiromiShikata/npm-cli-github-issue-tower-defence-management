"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clSessionScopeUnitName = void 0;
const clSessionScopeUnitName = (sessionName) => {
    const safe = sessionName.replace(/[^a-zA-Z0-9]/g, '-');
    const raw = `cl-${safe}`;
    return `${raw.replace(/[^a-zA-Z0-9._-]/g, '-')}.scope`;
};
exports.clSessionScopeUnitName = clSessionScopeUnitName;
//# sourceMappingURL=clSessionScopeUnitName.js.map