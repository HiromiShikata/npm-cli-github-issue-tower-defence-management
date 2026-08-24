"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeReportBody = void 0;
const normalizeReportBody = (body) => body.replace(/\\`/g, '`').replace(/\r\n/g, '\n');
exports.normalizeReportBody = normalizeReportBody;
//# sourceMappingURL=normalizeReportBody.js.map