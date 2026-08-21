"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectRequiredFieldCreateUseCase = void 0;
const ProjectFieldName_1 = require("../entities/ProjectFieldName");
const RequiredProjectField_1 = require("../entities/RequiredProjectField");
class ProjectRequiredFieldCreateUseCase {
    constructor(projectRepository) {
        this.projectRepository = projectRepository;
        this.run = async (params) => {
            const project = await this.projectRepository.getByUrl(params.projectUrl);
            await this.createMissingFields(project);
            const updatedProject = await this.projectRepository.getByUrl(params.projectUrl);
            await this.reconcileStoryOptions(updatedProject);
            await this.reconcileAgentOptions(updatedProject, params.agents ?? null);
        };
        this.createMissingFields = async (project) => {
            const existingFieldNames = (await this.projectRepository.listFieldNames(project)).map(ProjectFieldName_1.normalizeProjectFieldName);
            for (const required of RequiredProjectField_1.REQUIRED_PROJECT_FIELDS) {
                if (existingFieldNames.includes((0, ProjectFieldName_1.normalizeProjectFieldName)(required.name))) {
                    continue;
                }
                await this.projectRepository.createField(project, required);
            }
        };
        this.reconcileStoryOptions = async (project) => {
            if (!project.story) {
                return;
            }
            const storyFieldDefinition = RequiredProjectField_1.REQUIRED_PROJECT_FIELDS.find((f) => (0, ProjectFieldName_1.normalizeProjectFieldName)(f.name) ===
                (0, ProjectFieldName_1.normalizeProjectFieldName)(RequiredProjectField_1.STORY_FIELD_NAME));
            if (!storyFieldDefinition) {
                return;
            }
            const requiredOptions = storyFieldDefinition.options;
            const mergedOptions = project.story.stories.map((o) => ({
                ...o,
            }));
            let addedCount = 0;
            let previousRequiredIndex = -1;
            for (const required of requiredOptions) {
                const existingIndex = mergedOptions.findIndex((o) => this.optionNameSatisfies(o.name, required.name));
                if (existingIndex >= 0) {
                    previousRequiredIndex = existingIndex;
                    continue;
                }
                const insertIndex = previousRequiredIndex + 1;
                mergedOptions.splice(insertIndex, 0, { ...required, id: null });
                previousRequiredIndex = insertIndex;
                addedCount += 1;
            }
            if (addedCount === 0) {
                return;
            }
            await this.projectRepository.updateStoryList(project, mergedOptions);
        };
        this.reconcileAgentOptions = async (project, agentNames) => {
            if (!project.agent || !agentNames || agentNames.length === 0) {
                return;
            }
            const existingOptions = project.agent.options;
            const existingNames = new Set(existingOptions.map((o) => (0, ProjectFieldName_1.normalizeProjectFieldName)(o.name)));
            const toAdd = agentNames.filter((name) => !existingNames.has((0, ProjectFieldName_1.normalizeProjectFieldName)(name)));
            if (toAdd.length === 0) {
                return;
            }
            const mergedOptions = [
                ...existingOptions.map((o) => ({ ...o })),
                ...toAdd.map((name) => ({
                    id: null,
                    name,
                    color: 'GRAY',
                    description: '',
                })),
            ];
            await this.projectRepository.updateAgentList(project, mergedOptions);
        };
        this.optionNameSatisfies = (currentName, requiredName) => (0, ProjectFieldName_1.normalizeProjectFieldName)(currentName).startsWith((0, ProjectFieldName_1.normalizeProjectFieldName)(requiredName));
    }
}
exports.ProjectRequiredFieldCreateUseCase = ProjectRequiredFieldCreateUseCase;
ProjectRequiredFieldCreateUseCase.AGENT_FIELD_NAME = RequiredProjectField_1.AGENT_FIELD_NAME;
//# sourceMappingURL=ProjectRequiredFieldCreateUseCase.js.map