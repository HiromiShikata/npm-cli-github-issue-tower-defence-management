"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDashboardDisplayLabel = exports.DASHBOARD_PROJECT_NAMES = exports.DASHBOARD_DISPLAY_LABEL_BY_PROJECT_NAME = void 0;
exports.DASHBOARD_DISPLAY_LABEL_BY_PROJECT_NAME = {
    umino: 'um',
    xmile: 'xm',
    xcare: 'xc',
    utage3: 'ut',
};
exports.DASHBOARD_PROJECT_NAMES = Object.keys(exports.DASHBOARD_DISPLAY_LABEL_BY_PROJECT_NAME);
const toDashboardDisplayLabel = (projectName) => {
    const label = exports.DASHBOARD_DISPLAY_LABEL_BY_PROJECT_NAME[projectName];
    if (label === undefined) {
        throw new Error(`Unknown dashboard project name: ${projectName}. Add it to DASHBOARD_DISPLAY_LABEL_BY_PROJECT_NAME.`);
    }
    return label;
};
exports.toDashboardDisplayLabel = toDashboardDisplayLabel;
//# sourceMappingURL=DashboardProjectCode.js.map