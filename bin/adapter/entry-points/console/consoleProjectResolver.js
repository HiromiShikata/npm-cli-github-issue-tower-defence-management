"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConsoleProjectResolver = exports.buildPjcodeToProjectUrl = void 0;
const buildPjcodeToProjectUrl = (defaultPjcode, defaultProjectUrl, consoleProjects) => {
    const mapping = {};
    if (consoleProjects !== null) {
        for (const [pjcode, projectUrl] of Object.entries(consoleProjects)) {
            mapping[pjcode] = projectUrl;
        }
    }
    if (!(defaultPjcode in mapping)) {
        mapping[defaultPjcode] = defaultProjectUrl;
    }
    return mapping;
};
exports.buildPjcodeToProjectUrl = buildPjcodeToProjectUrl;
const createConsoleProjectResolver = (pjcodeToProjectUrl, loadProject) => {
    const cache = new Map();
    return async (pjcode) => {
        const cached = cache.get(pjcode);
        if (cached !== undefined) {
            return cached;
        }
        const projectUrl = pjcodeToProjectUrl[pjcode];
        if (projectUrl === undefined) {
            return null;
        }
        const project = await loadProject(projectUrl);
        if (project === null) {
            return null;
        }
        const binding = { pjcode, project };
        cache.set(pjcode, binding);
        return binding;
    };
};
exports.createConsoleProjectResolver = createConsoleProjectResolver;
//# sourceMappingURL=consoleProjectResolver.js.map