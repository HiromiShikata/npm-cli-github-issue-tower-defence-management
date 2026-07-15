import { SubAgentActivity } from '../entities/LiveSessionActivitySnapshot';
import {
  SilentSessionMessageComposer,
  SubAgentStallSections,
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
    `${SILENT_SESSION_REMINDER_SENTINEL} This is an automated status check. The following sub-process(es) have produced no output for about the minutes shown, measured from their last tool activity:`,
    ...lines,
    'For each one: if it is waiting on an external dependency (a continuous-integration run, an external API, or another process), no action is needed — please log one line noting the wait. If it appears stuck, please restart it, hand it off, or replace it.',
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
    `${SILENT_SESSION_REMINDER_SENTINEL} This is an automated status check. The following sub-process(es) have been running longer than a task usually takes:`,
    ...lines,
    'If one is not making progress toward completion, consider breaking the task down, restarting it, handing it off, or replacing it. If it is progressing normally, no action is needed.',
  ].join('\n');
};

export const composeOwnerCallFormatGuidance = (): string => {
  return 'Please share it through a new owner-call in the format documented for this session, written to be self-contained so the owner can understand the situation from that single message.';
};

const composeMainStalledMessage = (mainSilentSeconds: number): string => {
  const minutes = Math.floor(mainSilentSeconds / 60);
  return [
    `${SILENT_SESSION_REMINDER_SENTINEL} This is an automated status check. No output has been observed for ${minutes} minutes. If you are waiting on an external process, no action is needed — please log one line explaining the wait. Otherwise please continue with the next step, with these points in mind:`,
    `1. Keep the session task list current, marking finished items as done.`,
    `2. Run independent pieces of work in parallel across sub-agents.`,
    `3. Keep a monitor in place that notices when a sub-agent has produced no output for about 5 minutes.`,
    `4. When an owner decision is needed, or when an owner request has been completed or answered, the owner is notified only when a new owner-call is raised. ${composeOwnerCallFormatGuidance()}`,
    `Please also include in your next output an estimate of the remaining minutes to finish all tasks.`,
  ].join('\n');
};

const composeMainStalledWithStaleOwnerCallMessage = (
  mainSilentSeconds: number,
  unansweredOwnerCallAgeSeconds: number,
): string => {
  const silentMinutes = Math.floor(mainSilentSeconds / 60);
  const ownerCallAgeMinutes = Math.floor(unansweredOwnerCallAgeSeconds / 60);
  return [
    `${SILENT_SESSION_REMINDER_SENTINEL} This is an automated status check. No output has been observed for ${silentMinutes} minutes, and the owner call raised ${ownerCallAgeMinutes} minutes ago has not yet been acknowledged by the owner.`,
    `An owner call without an acknowledgment — whether it carried a completion report, a question, or a decision request — is still awaiting the owner's acknowledgment, and the earlier message may have been missed. Please re-raise its content as a fresh, self-contained owner call. ${composeOwnerCallFormatGuidance()}`,
    `Please also include in your next output an estimate of the remaining minutes to finish all tasks.`,
  ].join('\n');
};

export class DefaultSilentSessionMessageComposer implements SilentSessionMessageComposer {
  composeMainStalledSection = (mainSilentSeconds: number): string => {
    return composeMainStalledMessage(mainSilentSeconds);
  };

  composeMainStalledWithStaleOwnerCallSection = (
    mainSilentSeconds: number,
    unansweredOwnerCallAgeSeconds: number,
  ): string => {
    return composeMainStalledWithStaleOwnerCallMessage(
      mainSilentSeconds,
      unansweredOwnerCallAgeSeconds,
    );
  };

  composeSubAgentSection = (stallSections: SubAgentStallSections): string => {
    const sections: string[] = [];
    if (stallSections.idleSubAgents.length > 0) {
      sections.push(composeIdleSubAgentSection(stallSections.idleSubAgents));
    }
    if (stallSections.longRunningSubAgents.length > 0) {
      sections.push(
        composeLongRunningSubAgentSection(stallSections.longRunningSubAgents),
      );
    }
    return sections.join('\n\n');
  };
}
