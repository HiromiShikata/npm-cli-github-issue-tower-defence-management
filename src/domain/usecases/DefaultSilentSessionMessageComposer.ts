import { SubAgentActivity } from '../entities/LiveSessionActivitySnapshot';
import { SilentSessionMessageComposer } from './adapter-interfaces/SilentSessionMessageComposer';

const formatMinutes = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
};

export class DefaultSilentSessionMessageComposer
  implements SilentSessionMessageComposer
{
  composeMainStalledSection = (mainSilentSeconds: number): string => {
    return [
      `Main session has produced no output for ${formatMinutes(
        mainSilentSeconds,
      )}.`,
      '1. Re-check that every request you received is tracked as a session task and that your plan is the fastest possible (parallelize independent work, delegate, and remove needless serialization).',
      '2. Confirm there is no unanswered item waiting for the owner; only contact the owner when a confirmation, question, or decision is genuinely required, and do so carefully because contacting the owner interrupts their work.',
    ].join('\n');
  };

  composeSubAgentSection = (subAgents: SubAgentActivity[]): string => {
    const lines = subAgents.map(
      (subAgent) =>
        `- ${subAgent.label}: silent for ${formatMinutes(
          subAgent.silentSeconds,
        )}, running for ${formatMinutes(subAgent.runningSeconds)}`,
    );
    return [
      'The following sub-processes have been silent or running for a long time:',
      ...lines,
      'If a sub-process is stalled, take action (restart, hand off, or replace it). If it is legitimately waiting on an external dependency (continuous integration, an external API, or another process), let it continue.',
    ].join('\n');
  };
}
