"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clSessionScopeUnitNameFromCgroupContent = void 0;
const CL_SESSION_SCOPE_UNIT_PATTERN = /cl-[A-Za-z0-9._-]+\.scope/;
const clSessionScopeUnitNameFromCgroupContent = (cgroupContent) => {
    const match = cgroupContent.match(CL_SESSION_SCOPE_UNIT_PATTERN);
    return match ? match[0] : null;
};
exports.clSessionScopeUnitNameFromCgroupContent = clSessionScopeUnitNameFromCgroupContent;
//# sourceMappingURL=clSessionScopeUnitNameFromCgroupContent.js.map