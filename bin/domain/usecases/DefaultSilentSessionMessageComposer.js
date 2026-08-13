"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultSilentSessionMessageComposer = exports.composeOwnerCallFormatGuidance = void 0;
const silentSessionReminderSentinel_1 = require("./silentSessionReminderSentinel");
const formatMinutes = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
};
const composeIdleSubAgentSection = (idleSubAgents) => {
    const lines = idleSubAgents.map((subAgent) => `- ${subAgent.label}: no output for ${formatMinutes(subAgent.silentSeconds)}`);
    return [
        `${silentSessionReminderSentinel_1.SILENT_SESSION_REMINDER_SENTINEL} This is an automated status check. The following sub-process(es) have produced no output for about the minutes shown, measured from their last tool activity:`,
        ...lines,
        'For each one: if it is waiting on an external dependency (a continuous-integration run, an external API, or another process), no action is needed — please log one line noting the wait. If it appears stuck, please restart it, hand it off, or replace it.',
    ].join('\n');
};
const composeLongRunningSubAgentSection = (longRunningSubAgents) => {
    const lines = longRunningSubAgents.map((subAgent) => `- ${subAgent.label}: running for ${formatMinutes(subAgent.runningSeconds)}`);
    return [
        `${silentSessionReminderSentinel_1.SILENT_SESSION_REMINDER_SENTINEL} This is an automated status check. The following sub-process(es) have been running longer than a task usually takes:`,
        ...lines,
        'If one is not making progress toward completion, consider breaking the task down, restarting it, handing it off, or replacing it. If it is progressing normally, no action is needed.',
    ].join('\n');
};
const composeOwnerCallFormatGuidance = () => {
    return 'Please share it through a new owner-call in the format documented for this session, written to be self-contained so the owner can understand the situation from that single message.';
};
exports.composeOwnerCallFormatGuidance = composeOwnerCallFormatGuidance;
const composeMainStalledMessage = (mainSilentSeconds) => {
    const minutes = Math.floor(mainSilentSeconds / 60);
    return [
        `${silentSessionReminderSentinel_1.SILENT_SESSION_REMINDER_SENTINEL} This is an automated status check. No output has been observed for ${minutes} minutes. If you are waiting on an automated process that runs without the owner - a continuous-integration run, an external API, or another process - no action is needed beyond logging one line explaining the wait. If you are waiting on something only the owner can supply - a decision, an approval, a credential, or an answer - please raise an owner-call now, because that wait is resolved only after the owner has been notified. Otherwise please continue with the next step, with these points in mind:`,
        `1. Keep the session task list current, marking finished items as done.`,
        `2. Run independent pieces of work in parallel across sub-agents.`,
        `3. Keep a monitor in place that notices when a sub-agent has produced no output for about 5 minutes.`,
        `4. Resume the assigned work now by taking its next concrete step with a tool call, and report the result of that step in your next output. A period without output means the assigned work is not progressing, so it is not by itself a reason to contact the owner; please resume the work rather than sending a message about the absence of progress.`,
        `Please also include in your next output an estimate of the remaining minutes to finish all tasks.`,
    ].join('\n');
};
const composeMainStalledWithStaleOwnerCallMessage = (mainSilentSeconds, unansweredOwnerCallAgeSeconds) => {
    const silentMinutes = Math.floor(mainSilentSeconds / 60);
    const ownerCallAgeMinutes = Math.floor(unansweredOwnerCallAgeSeconds / 60);
    return [
        `${silentSessionReminderSentinel_1.SILENT_SESSION_REMINDER_SENTINEL} This is an automated status check. No output has been observed for ${silentMinutes} minutes, and the owner call raised ${ownerCallAgeMinutes} minutes ago has not yet been acknowledged by the owner.`,
        `An owner call without an acknowledgment — whether it carried a completion report, a question, or a decision request — is still awaiting the owner's acknowledgment, and the earlier message may have been missed. Please re-raise its content as a fresh, self-contained owner call. ${(0, exports.composeOwnerCallFormatGuidance)()}`,
        `Please also include in your next output an estimate of the remaining minutes to finish all tasks.`,
    ].join('\n');
};
class DefaultSilentSessionMessageComposer {
    constructor() {
        this.composeMainStalledSection = (mainSilentSeconds) => {
            return composeMainStalledMessage(mainSilentSeconds);
        };
        this.composeMainStalledWithStaleOwnerCallSection = (mainSilentSeconds, unansweredOwnerCallAgeSeconds) => {
            return composeMainStalledWithStaleOwnerCallMessage(mainSilentSeconds, unansweredOwnerCallAgeSeconds);
        };
        this.composeSubAgentSection = (stallSections) => {
            const sections = [];
            if (stallSections.idleSubAgents.length > 0) {
                sections.push(composeIdleSubAgentSection(stallSections.idleSubAgents));
            }
            if (stallSections.longRunningSubAgents.length > 0) {
                sections.push(composeLongRunningSubAgentSection(stallSections.longRunningSubAgents));
            }
            return sections.join('\n\n');
        };
    }
}
exports.DefaultSilentSessionMessageComposer = DefaultSilentSessionMessageComposer;
//# sourceMappingURL=DefaultSilentSessionMessageComposer.js.map