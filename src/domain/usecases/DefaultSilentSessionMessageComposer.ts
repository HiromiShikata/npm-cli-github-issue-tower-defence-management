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

const composeUnconsumedResultSubAgentSection = (
  unconsumedResultSubAgents: SubAgentActivity[],
): string => {
  const lines = unconsumedResultSubAgents.map(
    (subAgent) =>
      `- ${subAgent.label}: result unconsumed for ${formatMinutes(
        subAgent.silentSeconds,
      )}`,
  );
  return [
    `${SILENT_SESSION_REMINDER_SENTINEL} This is an automated status check. The following sub-process(es) have finished and their results have been waiting unread for about the minutes shown:`,
    ...lines,
    'For each one: please read its result, act on it, and then mark the sub-process as finished so it is no longer tracked as running. If you have already acted on the result, marking it finished is all that remains.',
  ].join('\n');
};

export class DefaultSilentSessionMessageComposer implements SilentSessionMessageComposer {
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

  composeSubAgentUnconsumedResultSection = (
    unconsumedResultSubAgents: SubAgentActivity[],
  ): string =>
    composeUnconsumedResultSubAgentSection(unconsumedResultSubAgents);
}
