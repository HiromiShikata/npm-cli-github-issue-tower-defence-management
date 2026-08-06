"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertDashboardDisplayLabelsUnique = exports.toDashboardDisplayLabel = exports.DASHBOARD_DISPLAY_LABEL_LENGTH = void 0;
exports.DASHBOARD_DISPLAY_LABEL_LENGTH = 2;
const toDashboardDisplayLabel = (projectName) => {
    if (projectName.length < exports.DASHBOARD_DISPLAY_LABEL_LENGTH) {
        throw new Error(`Dashboard project name is shorter than the ${exports.DASHBOARD_DISPLAY_LABEL_LENGTH}-character display label: ${projectName}`);
    }
    return projectName.slice(0, exports.DASHBOARD_DISPLAY_LABEL_LENGTH);
};
exports.toDashboardDisplayLabel = toDashboardDisplayLabel;
const assertDashboardDisplayLabelsUnique = (projectNames) => {
    const projectNameByDisplayLabel = new Map();
    for (const projectName of projectNames) {
        const displayLabel = (0, exports.toDashboardDisplayLabel)(projectName);
        const alreadyRegistered = projectNameByDisplayLabel.get(displayLabel) ?? null;
        if (alreadyRegistered !== null) {
            throw new Error(`Dashboard project names ${alreadyRegistered} and ${projectName} share the display label ${displayLabel}`);
        }
        projectNameByDisplayLabel.set(displayLabel, projectName);
    }
};
exports.assertDashboardDisplayLabelsUnique = assertDashboardDisplayLabelsUnique;
//# sourceMappingURL=DashboardProjectCode.js.map