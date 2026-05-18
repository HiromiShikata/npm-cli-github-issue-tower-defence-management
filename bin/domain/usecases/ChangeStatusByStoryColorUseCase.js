"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeStatusByStoryColorUseCase = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
class ChangeStatusByStoryColorUseCase {
    constructor(dateRepository, issueRepository) {
        this.dateRepository = dateRepository;
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const firstStatus = input.project.status.statuses[0];
            if (!firstStatus) {
                throw new Error('First status is not found');
            }
            else if (input.cacheUsed) {
                return;
            }
            const disabledStatusObject = input.project.status.statuses.find((status) => status.name === WorkflowStatus_1.ICEBOX_STATUS_NAME);
            if (!disabledStatusObject) {
                throw new Error('Icebox status is not found');
            }
            for (const storyObject of Array.from(input.storyObjectMap.values())) {
                const isStoryDisabled = storyObject.story.color === 'GRAY';
                for (const issue of storyObject.issues) {
                    if (isStoryDisabled) {
                        if (issue.status && issue.status === WorkflowStatus_1.ICEBOX_STATUS_NAME) {
                            continue;
                        }
                        await this.issueRepository.updateStatus(input.project, issue, disabledStatusObject.id);
                        await this.issueRepository.createComment(issue, `This issue status is changed because the story is disabled.`);
                    }
                    else if (!isStoryDisabled) {
                        if (issue.status && issue.status !== WorkflowStatus_1.ICEBOX_STATUS_NAME) {
                            continue;
                        }
                        await this.issueRepository.updateStatus(input.project, issue, firstStatus.id);
                        await this.issueRepository.createComment(issue, `This issue status is changed because the story is enabled.`);
                    }
                }
            }
        };
    }
}
exports.ChangeStatusByStoryColorUseCase = ChangeStatusByStoryColorUseCase;
//# sourceMappingURL=ChangeStatusByStoryColorUseCase.js.map