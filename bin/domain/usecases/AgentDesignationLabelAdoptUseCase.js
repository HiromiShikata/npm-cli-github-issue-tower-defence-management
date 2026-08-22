"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentDesignationLabelAdoptUseCase = exports.adoptIssueAgentDesignationLabel = void 0;
const ensureAgentOptionAndGetId_1 = require("./ensureAgentOptionAndGetId");
const adoptIssueAgentDesignationLabel = async (issue, project, configuredAgentNames, projectRepository, issueRepository) => {
    if (issue.agent !== null) {
        return;
    }
    const agentLabel = issue.labels.find((label) => configuredAgentNames.includes(label));
    if (agentLabel === undefined) {
        return;
    }
    issue.agent = agentLabel;
    const agentOptionId = await (0, ensureAgentOptionAndGetId_1.ensureAgentOptionAndGetId)(projectRepository, project, agentLabel);
    if (agentOptionId === null) {
        console.warn(`Agent field option '${agentLabel}' could not be resolved for ${issue.url}. Keeping the label as the agent designation.`);
        return;
    }
    await issueRepository.setIssueAgentField(issue.url, project, agentOptionId);
    await issueRepository.removeLabel(issue, agentLabel);
    issue.labels = issue.labels.filter((label) => label !== agentLabel);
};
exports.adoptIssueAgentDesignationLabel = adoptIssueAgentDesignationLabel;
class AgentDesignationLabelAdoptUseCase {
    constructor(projectRepository, issueRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.run = async (params) => {
            if (!params.agents || params.agents.length === 0) {
                return;
            }
            for (const issue of params.issues) {
                if (issue.isClosed) {
                    continue;
                }
                await (0, exports.adoptIssueAgentDesignationLabel)(issue, params.project, params.agents, this.projectRepository, this.issueRepository);
            }
        };
    }
}
exports.AgentDesignationLabelAdoptUseCase = AgentDesignationLabelAdoptUseCase;
//# sourceMappingURL=AgentDesignationLabelAdoptUseCase.js.map