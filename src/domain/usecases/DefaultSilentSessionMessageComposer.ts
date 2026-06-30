import { SubAgentActivity } from '../entities/LiveSessionActivitySnapshot';
import {
  SilentSessionMessageComposer,
  SubAgentStallThresholds,
} from './adapter-interfaces/SilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from './silentSessionReminderSentinel';

const formatMinutes = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
};

const composeIdleSubAgentSection = (
  idleSubAgents: SubAgentActivity[],
): string => {
  const lines = idleSubAgents.map(
    (subAgent) =>
      `- ${subAgent.label}: no output for ${formatMinutes(
        subAgent.silentSeconds,
      )}`,
  );
  return [
    `${SILENT_SESSION_REMINDER_SENTINEL} The following sub-process(es) have produced no output for several minutes and may be stalled:`,
    ...lines,
    'Check each one. If it is stuck, take action (restart, hand off, or replace it). If it is legitimately waiting on an external dependency (continuous integration, an external API, or another process), let it continue.',
  ].join('\n');
};

const composeLongRunningSubAgentSection = (
  longRunningSubAgents: SubAgentActivity[],
): string => {
  const lines = longRunningSubAgents.map(
    (subAgent) =>
      `- ${subAgent.label}: running for ${formatMinutes(
        subAgent.runningSeconds,
      )}`,
  );
  return [
    `${SILENT_SESSION_REMINDER_SENTINEL} The following sub-process(es) have been running longer than a task should normally take, which may mean an infinite loop, a task that is too large, or being stuck in an incorrect approach that is not making forward progress:`,
    ...lines,
    'Verify each one is genuinely advancing toward completion; do not dismiss it merely because it produced output recently. If it is not progressing, intervene: break the task down, restart, hand off, or replace it.',
  ].join('\n');
};

const composeOwnerCallFormatGuidance = (
  ownerCallMarker: string | null,
): string => {
  const markerInstruction =
    ownerCallMarker !== null && ownerCallMarker.length > 0
      ? `Emit the owner-call as the configured owner-call marker tag "${ownerCallMarker}" as a complete matching pair — opening marker, content, then closing marker — on a single line with no newline inside the tag.`
      : `Emit the owner-call as the configured owner-call marker tag as a complete matching pair — opening marker, content, then closing marker — on a single line with no newline inside the tag.`;
  return `${markerInstruction} The content between the markers MUST begin with the 🔴 emoji immediately, with no space after it. The owner's app only surfaces the notification together with its content when the exact, well-formed tag with the leading 🔴 is present; a malformed tag (a broken or missing closing marker, or a missing leading 🔴) results in only a red indicator with no readable content.`;
};

const composeMainStalledMessage = (
  mainSilentSeconds: number,
  ownerCallMarker: string | null,
): string => {
  const minutes = Math.floor(mainSilentSeconds / 60);
  return [
    `${SILENT_SESSION_REMINDER_SENTINEL} You have produced no output for ${minutes} minutes. Idle waiting wastes this live session and is unacceptable. Always work proactively and stay ahead of the work: anticipate the next steps and, at every point, choose the fastest path so the whole task finishes as early as possible; never wait passively. Finish every task in the shortest possible time — but "fastest" means correct and incident-free, not merely quick: a fast but wrong result is worthless and causes incidents, so be fast without breaking things. Use parallel execution and your whole team of sub-agents to minimize total wall-clock time. Your goal is to drive every task to completion and have the owner confirm that all tasks are done. Do NOT close this session on your own — it is closed only after the owner has verified completion and tells you to close it. Self-check now:`,
    `1. Every request from the owner is registered as a session task and your task list is kept current (mark tasks completed when done); verify nothing is missing or stale.`,
    `2. Your plan is the fastest correct path: parallelize independent work across sub-agents, delegate, and remove needless serialization. Choose the fastest safe method, not the easiest.`,
    `3. A monitor is in place that detects when any sub-agent produces no output for 5 minutes.`,
    `4. If you are blocked on an owner decision — or once you believe all tasks are complete — do not wait passively: the owner is not notified of passive waiting and will not reply unless you raise a new call-to-user, so raise one now (to get the decision, or to ask the owner to verify completion). If you have COMPLETED or ANSWERED a request from the owner in this session, you MUST fire the owner-call to report the RESULT to the owner: completing or answering an owner's requested action is itself a reason to fire the owner-call. Completing or answering an owner request WITHOUT firing the owner-call means the owner is NEVER notified — the owner's app only surfaces this session when the owner-call fires — so the task silently stalls. If this self-check reminder keeps arriving, it is likely because an owner request was completed or answered without firing the owner-call; fire the owner-call now to report the result to the owner. ${composeOwnerCallFormatGuidance(ownerCallMarker)} If no owner input is needed yet, resume immediately and drive all remaining tasks to completion.`,
    `Also, in your next output, report an estimate of how many minutes you expect to need to finish all remaining tasks.`,
  ].join('\n');
};

export class DefaultSilentSessionMessageComposer implements SilentSessionMessageComposer {
  constructor(private readonly ownerCallMarker: string | null = null) {}

  composeMainStalledSection = (mainSilentSeconds: number): string => {
    return composeMainStalledMessage(mainSilentSeconds, this.ownerCallMarker);
  };

  composeSubAgentSection = (
    subAgents: SubAgentActivity[],
    thresholds: SubAgentStallThresholds,
  ): string => {
    const idleSubAgents = subAgents.filter(
      (subAgent) =>
        subAgent.silentSeconds >= thresholds.subAgentSilentThresholdSeconds,
    );
    const longRunningSubAgents = subAgents.filter(
      (subAgent) =>
        subAgent.runningSeconds >= thresholds.subAgentRunningThresholdSeconds,
    );
    const sections: string[] = [];
    if (idleSubAgents.length > 0) {
      sections.push(composeIdleSubAgentSection(idleSubAgents));
    }
    if (longRunningSubAgents.length > 0) {
      sections.push(composeLongRunningSubAgentSection(longRunningSubAgents));
    }
    return sections.join('\n\n');
  };
}
