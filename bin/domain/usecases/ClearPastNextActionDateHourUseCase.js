"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClearPastNextActionDateHourUseCase = void 0;
class ClearPastNextActionDateHourUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            if (input.targetDates.length === 0) {
                return;
            }
            const now = input.targetDates[input.targetDates.length - 1];
            const nextActionHourField = input.project.nextActionHour;
            if (nextActionHourField) {
                const nextActionDateField = input.project.nextActionDate;
                for (const issue of input.issues) {
                    if (issue.nextActionHour === null || issue.state !== 'OPEN') {
                        continue;
                    }
                    const scheduledDate = issue.nextActionDate ?? now;
                    const scheduledTime = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate(), issue.nextActionHour);
                    if (scheduledTime.getTime() > now.getTime()) {
                        continue;
                    }
                    await this.issueRepository.clearProjectField(input.project, nextActionHourField.fieldId, issue);
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                    if (!nextActionDateField) {
                        continue;
                    }
                    await this.issueRepository.clearProjectField(input.project, nextActionDateField.fieldId, issue);
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            }
            const nextActionDate = input.project.nextActionDate;
            if (!nextActionDate) {
                return;
            }
            const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            for (const issue of input.issues) {
                if (issue.nextActionHour !== null ||
                    (issue.nextActionDate?.getTime() ?? Infinity) >=
                        startOfTomorrow.getTime() ||
                    issue.state !== 'OPEN') {
                    continue;
                }
                await this.issueRepository.clearProjectField(input.project, nextActionDate.fieldId, issue);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        };
    }
}
exports.ClearPastNextActionDateHourUseCase = ClearPastNextActionDateHourUseCase;
//# sourceMappingURL=ClearPastNextActionDateHourUseCase.js.map