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
        `${silentSessionReminderSentinel_1.SILENT_SESSION_REMINDER_SENTINEL} The system has already detected, from each sub-process's last tool activity, that it has produced no output for about the minutes shown below. Treat that figure as the authoritative system signal; do NOT spend effort re-deriving whether the sub-process is alive. Around five minutes of silence is a real warning of a possible hang: do NOT speak from speculation ("probably still working") and do NOT dismiss it without evidence.`,
        ...lines,
        'For each one, determine the CAUSE by a concrete check and report the result. Verify specifically: (a) whether there is genuinely no recent activity anywhere — including a very recent push or commit, or output from any nested sub-processes this sub-process itself started; and (b) whether it is legitimately blocked waiting on an external dependency (a continuous-integration run, an external API, or another process). Waiting on continuous integration is plausible, but confirm it by investigation before concluding — do not assume. Based on the check: if it is genuinely stuck, take action (restart, hand off, or replace it); if it is legitimately waiting, state that conclusion together with the concrete evidence you found. Owner notification is not required, but you MUST output your investigation result in this session so it remains as a log.',
    ].join('\n');
};
const composeLongRunningSubAgentSection = (longRunningSubAgents) => {
    const lines = longRunningSubAgents.map((subAgent) => `- ${subAgent.label}: running for ${formatMinutes(subAgent.runningSeconds)}`);
    return [
        `${silentSessionReminderSentinel_1.SILENT_SESSION_REMINDER_SENTINEL} The following sub-process(es) have been running longer than a task should normally take, which may mean an infinite loop, a task that is too large, or being stuck in an incorrect approach that is not making forward progress:`,
        ...lines,
        'Verify each one is genuinely advancing toward completion; do not dismiss it merely because it produced output recently. If it is not progressing, intervene: break the task down, restart, hand off, or replace it.',
    ].join('\n');
};
const composeOwnerCallFormatGuidance = (ownerCallMarker) => {
    const markerInstruction = ownerCallMarker !== null && ownerCallMarker.length > 0
        ? `Emit the owner-call as the configured owner-call marker tag "${ownerCallMarker}" as a complete matching pair — opening marker, content, then closing marker — on a single line with no newline inside the tag.`
        : `Emit the owner-call as the configured owner-call marker tag as a complete matching pair — opening marker, content, then closing marker — on a single line with no newline inside the tag.`;
    return `${markerInstruction} The content between the markers MUST begin with the 🔴 emoji immediately, with no space after it. The owner's app only surfaces the notification together with its content when the exact, well-formed tag with the leading 🔴 is present; a malformed tag (a broken or missing closing marker, or a missing leading 🔴) results in only a red indicator with no readable content. Make the owner-call message fully self-contained: the owner MUST understand the whole situation — what happened, what you are asking, and any decision needed — from this single latest owner-call message alone, without reading or scrolling back to earlier messages. NEVER tell the owner to scroll up, go back, or read previous or above messages; if context is needed, restate it inside the owner-call message itself.`;
};
exports.composeOwnerCallFormatGuidance = composeOwnerCallFormatGuidance;
const composeMainStalledMessage = (mainSilentSeconds, ownerCallMarker) => {
    const minutes = Math.floor(mainSilentSeconds / 60);
    return [
        `${silentSessionReminderSentinel_1.SILENT_SESSION_REMINDER_SENTINEL} You have produced no output for ${minutes} minutes. Idle waiting wastes this live session and is unacceptable. Always work proactively and stay ahead of the work: anticipate the next steps and, at every point, choose the fastest path so the whole task finishes as early as possible; never wait passively. Finish every task in the shortest possible time — but "fastest" means correct and incident-free, not merely quick: a fast but wrong result is worthless and causes incidents, so be fast without breaking things. Use parallel execution and your whole team of sub-agents to minimize total wall-clock time. Your goal is to drive every task to completion and have the owner confirm that all tasks are done. Do NOT close this session on your own — it is closed only after the owner has verified completion and tells you to close it. Self-check now:`,
        `1. Every request from the owner is registered as a session task and your task list is kept current (mark tasks completed when done); verify nothing is missing or stale.`,
        `2. Your plan is the fastest correct path: parallelize independent work across sub-agents, delegate, and remove needless serialization. Choose the fastest safe method, not the easiest.`,
        `3. A monitor is in place that detects when any sub-agent produces no output for 5 minutes.`,
        `4. If you are blocked on an owner decision — or once you believe all tasks are complete — do not wait passively: the owner is not notified of passive waiting and will not reply unless you raise a new call-to-user, so raise one now (to get the decision, or to ask the owner to verify completion). If you have COMPLETED or ANSWERED a request from the owner in this session, you MUST fire the owner-call to report the RESULT to the owner: completing or answering an owner's requested action is itself a reason to fire the owner-call. Completing or answering an owner request WITHOUT firing the owner-call means the owner is NEVER notified — the owner's app only surfaces this session when the owner-call fires — so the task silently stalls. If this self-check reminder keeps arriving, it is likely because an owner request was completed or answered without firing the owner-call; fire the owner-call now to report the result to the owner. ${(0, exports.composeOwnerCallFormatGuidance)(ownerCallMarker)} If no owner input is needed yet, resume immediately and drive all remaining tasks to completion.`,
        `Also, in your next output, report an estimate of how many minutes you expect to need to finish all remaining tasks.`,
    ].join('\n');
};
class DefaultSilentSessionMessageComposer {
    constructor(ownerCallMarker = null) {
        this.ownerCallMarker = ownerCallMarker;
        this.composeMainStalledSection = (mainSilentSeconds) => {
            return composeMainStalledMessage(mainSilentSeconds, this.ownerCallMarker);
        };
        this.composeSubAgentSection = (subAgents, thresholds) => {
            const idleSubAgents = subAgents.filter((subAgent) => subAgent.silentSeconds >= thresholds.subAgentSilentThresholdSeconds);
            const longRunningSubAgents = subAgents.filter((subAgent) => subAgent.runningSeconds >= thresholds.subAgentRunningThresholdSeconds);
            const sections = [];
            if (idleSubAgents.length > 0) {
                sections.push(composeIdleSubAgentSection(idleSubAgents));
            }
            if (longRunningSubAgents.length > 0) {
                sections.push(composeLongRunningSubAgentSection(longRunningSubAgents));
            }
            return sections.join('\n\n');
        };
    }
}
exports.DefaultSilentSessionMessageComposer = DefaultSilentSessionMessageComposer;
//# sourceMappingURL=DefaultSilentSessionMessageComposer.js.map