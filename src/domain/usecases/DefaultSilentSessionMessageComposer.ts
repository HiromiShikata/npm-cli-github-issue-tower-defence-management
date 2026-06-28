import { SubAgentActivity } from '../entities/LiveSessionActivitySnapshot';
import { SilentSessionMessageComposer } from './adapter-interfaces/SilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from './silentSessionReminderSentinel';

const formatMinutes = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
};

const composeMainStalledMessage = (mainSilentSeconds: number): string => {
  const minutes = Math.floor(mainSilentSeconds / 60);
  return [
    `${SILENT_SESSION_REMINDER_SENTINEL} You have produced no output for ${minutes} minutes. Idle waiting wastes this live session and is unacceptable. Always work proactively and stay ahead of the work: anticipate the next steps and, at every point, choose the fastest path so the whole task finishes as early as possible; never wait passively. Finish every task in the shortest possible time — but "fastest" means correct and incident-free, not merely quick: a fast but wrong result is worthless and causes incidents, so be fast without breaking things. Use parallel execution and your whole team of sub-agents to minimize total wall-clock time. Your goal is to drive every task to completion and have the owner confirm that all tasks are done. Do NOT close this session on your own — it is closed only after the owner has verified completion and tells you to close it. Self-check now:`,
    `1. Every request from the owner is registered as a session task and your task list is kept current (mark tasks completed when done); verify nothing is missing or stale.`,
    `2. Your plan is the fastest correct path: parallelize independent work across sub-agents, delegate, and remove needless serialization. Choose the fastest safe method, not the easiest.`,
    `3. A monitor is in place that detects when any sub-agent produces no output for 5 minutes.`,
    `4. If you are blocked on an owner decision — or once you believe all tasks are complete — do not wait passively: the owner is not notified of passive waiting and will not reply unless you raise a new call-to-user, so raise one now (to get the decision, or to ask the owner to verify completion). If no owner input is needed yet, resume immediately and drive all remaining tasks to completion.`,
    `Also, in your next output, report an estimate of how many minutes you expect to need to finish all remaining tasks.`,
  ].join('\n');
};

const composeOwnerReNotificationMessage = (waitingSeconds: number): string => {
  const minutes = Math.floor(waitingSeconds / 60);
  return [
    `${SILENT_SESSION_REMINDER_SENTINEL} This is an automated monitor reminder, NOT the owner replying. Do NOT treat this message as an owner answer to your outstanding call-to-user; your pending question is still unanswered. You have been waiting on the owner for ${minutes} minutes and the owner has not yet replied. The owner is only notified when a fresh call-to-user is raised, so a single past call-to-user that has gone quiet will never reach them. Re-raise your pending call-to-user to the owner now: re-emit it so a new call-to-user marker fires and the owner is notified again. Keep your question and proposed options unchanged unless you have new information. You are correctly waiting on the owner — you are not stalled or idle — so do not abandon the wait and do not invent an owner decision yourself; simply re-surface the same request so the owner sees it.`,
  ].join('\n');
};

export class DefaultSilentSessionMessageComposer implements SilentSessionMessageComposer {
  composeMainStalledSection = (mainSilentSeconds: number): string => {
    return composeMainStalledMessage(mainSilentSeconds);
  };

  composeOwnerReNotificationSection = (waitingSeconds: number): string => {
    return composeOwnerReNotificationMessage(waitingSeconds);
  };

  composeSubAgentSection = (subAgents: SubAgentActivity[]): string => {
    const lines = subAgents.map(
      (subAgent) =>
        `- ${subAgent.label}: silent for ${formatMinutes(
          subAgent.silentSeconds,
        )}, running for ${formatMinutes(subAgent.runningSeconds)}`,
    );
    return [
      `${SILENT_SESSION_REMINDER_SENTINEL} The following sub-processes have been silent or running for a long time:`,
      ...lines,
      'If a sub-process is stalled, take action (restart, hand off, or replace it). If it is legitimately waiting on an external dependency (continuous integration, an external API, or another process), let it continue.',
    ].join('\n');
  };
}
