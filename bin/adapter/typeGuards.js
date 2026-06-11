"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecord = void 0;
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
exports.isRecord = isRecord;
//# sourceMappingURL=typeGuards.js.map