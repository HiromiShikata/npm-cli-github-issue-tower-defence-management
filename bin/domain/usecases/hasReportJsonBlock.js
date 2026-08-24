"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasReportJsonBlock = void 0;
const normalizeReportBody_1 = require("./normalizeReportBody");
const hasReportJsonBlock = (body) => /```json\n[\s\S]*?\n```/.test((0, normalizeReportBody_1.normalizeReportBody)(body));
exports.hasReportJsonBlock = hasReportJsonBlock;
//# sourceMappingURL=hasReportJsonBlock.js.map