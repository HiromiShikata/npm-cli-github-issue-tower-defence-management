"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractNextStepAgent = void 0;
const extractNextStepAgent = (body) => {
    const reportMatch = body.match(/```json\n([\s\S]*?)\n```/);
    if (!reportMatch || reportMatch.length < 2) {
        return null;
    }
    let reportJson;
    try {
        reportJson = JSON.parse(reportMatch[1]);
    }
    catch (error) {
        console.warn('Invalid JSON in report body while checking nextStepAgent:', error);
        return null;
    }
    if (typeof reportJson !== 'object' || reportJson === null) {
        return null;
    }
    if (!('nextStepAgent' in reportJson)) {
        return null;
    }
    const value = Reflect.get(reportJson, 'nextStepAgent');
    if (typeof value !== 'string' || value.trim() === '') {
        return null;
    }
    return value.trim();
};
exports.extractNextStepAgent = extractNextStepAgent;
//# sourceMappingURL=extractNextStepAgent.js.map