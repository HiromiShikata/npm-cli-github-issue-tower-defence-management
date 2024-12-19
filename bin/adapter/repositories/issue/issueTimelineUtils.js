"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInProgressTimeline = void 0;
const getInProgressTimeline = async (timelines, issueUrl) => {
    const report = [];
    let currentInProgress = undefined;
    for (const timeline of timelines) {
        const time = new Date(timeline.time);
        if (timeline.to.toLocaleLowerCase().includes('in progress')) {
            if (currentInProgress !== undefined) {
                report.push({
                    ...currentInProgress,
                    endedAt: time,
                    durationMinutes: Math.floor(time.getTime() / 1000 / 60) -
                        Math.floor(currentInProgress.startedAt.getTime() / 1000 / 60),
                });
                currentInProgress = undefined;
            }
            currentInProgress = {
                issueUrl: issueUrl,
                author: timeline.author,
                startedAt: time,
            };
            continue;
        }
        if (currentInProgress != undefined) {
            report.push({
                ...currentInProgress,
                endedAt: time,
                durationMinutes: (time.getTime() - currentInProgress.startedAt.getTime()) / 1000 / 60,
            });
            currentInProgress = undefined;
        }
    }
    return report;
};
exports.getInProgressTimeline = getInProgressTimeline;
//# sourceMappingURL=issueTimelineUtils.js.map