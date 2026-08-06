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
    }
}
exports.ProjectRequiredFieldCreateUseCase = ProjectRequiredFieldCreateUseCase;
//# sourceMappingURL=ProjectRequiredFieldCreateUseCase.js.map