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
            await this.reconcileStoryOptions(project);
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
            const currentOptions = project.story.stories;
            const currentByName = new Map(currentOptions.map((o) => [(0, ProjectFieldName_1.normalizeProjectFieldName)(o.name), o]));
            const missingRequired = requiredOptions.filter((r) => !currentByName.has((0, ProjectFieldName_1.normalizeProjectFieldName)(r.name)));
            if (missingRequired.length === 0) {
                return;
            }
            const requiredByName = new Set(requiredOptions.map((r) => (0, ProjectFieldName_1.normalizeProjectFieldName)(r.name)));
            const extraCurrentOptions = currentOptions.filter((o) => !requiredByName.has((0, ProjectFieldName_1.normalizeProjectFieldName)(o.name)));
            const mergedOptions = [
                ...requiredOptions.map((r) => {
                    const existing = currentByName.get((0, ProjectFieldName_1.normalizeProjectFieldName)(r.name));
                    return existing ? { ...r, id: existing.id } : { ...r, id: null };
                }),
                ...extraCurrentOptions.map((o) => ({ ...o })),
            ];
            await this.projectRepository.updateStoryList(project, mergedOptions);
        };
    }
}
exports.ProjectRequiredFieldCreateUseCase = ProjectRequiredFieldCreateUseCase;
//# sourceMappingURL=ProjectRequiredFieldCreateUseCase.js.map