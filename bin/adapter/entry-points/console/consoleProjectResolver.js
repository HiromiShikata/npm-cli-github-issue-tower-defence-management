"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConsoleProjectResolver = exports.createPjcodeConfigChecker = exports.buildPjcodeToProjectUrl = void 0;
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
// Builds a synchronous predicate that reports whether a pjcode is configured,
// using only the local pjcode-to-project-url mapping. This lets close
// operations validate the pjcode without loading the ProjectV2 via GraphQL.
const createPjcodeConfigChecker = (pjcodeToProjectUrl) => {
    return (pjcode) => Object.prototype.hasOwnProperty.call(pjcodeToProjectUrl, pjcode);
};
exports.createPjcodeConfigChecker = createPjcodeConfigChecker;
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