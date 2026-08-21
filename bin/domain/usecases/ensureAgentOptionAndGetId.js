"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAgentOptionAndGetId = void 0;
const ProjectFieldName_1 = require("../entities/ProjectFieldName");
const RequiredProjectField_1 = require("../entities/RequiredProjectField");
const ensureAgentOptionAndGetId = async (projectRepository, project, agentName) => {
    const normalizedTarget = (0, ProjectFieldName_1.normalizeProjectFieldName)(agentName);
    if (!project.agent) {
        await projectRepository.createField(project, {
            name: RequiredProjectField_1.AGENT_FIELD_NAME,
            dataType: 'SINGLE_SELECT',
            options: [{ name: agentName, color: 'GRAY', description: '' }],
        });
        const refreshed = await projectRepository.getByUrl(project.url);
        const created = refreshed.agent?.options.find((option) => (0, ProjectFieldName_1.normalizeProjectFieldName)(option.name) === normalizedTarget);
        return created?.id ?? null;
    }
    const existing = project.agent.options.find((option) => (0, ProjectFieldName_1.normalizeProjectFieldName)(option.name) === normalizedTarget);
    if (existing) {
        return existing.id;
    }
    const mergedOptions = [
        ...project.agent.options.map((option) => ({ ...option })),
        { id: null, name: agentName, color: 'GRAY', description: '' },
    ];
    const updatedOptions = await projectRepository.updateAgentList(project, mergedOptions);
    const created = updatedOptions.find((option) => (0, ProjectFieldName_1.normalizeProjectFieldName)(option.name) === normalizedTarget);
    return created?.id ?? null;
};
exports.ensureAgentOptionAndGetId = ensureAgentOptionAndGetId;
//# sourceMappingURL=ensureAgentOptionAndGetId.js.map