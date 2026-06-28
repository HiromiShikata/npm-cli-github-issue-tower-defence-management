import { SubAgentActivity } from '../../domain/entities/LiveSessionActivitySnapshot';
import { SilentSessionMessageComposer } from '../../domain/usecases/adapter-interfaces/SilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from '../../domain/usecases/silentSessionReminderSentinel';

const withReminderSentinel = (message: string): string =>
  message.includes(SILENT_SESSION_REMINDER_SENTINEL)
    ? message
    : `${SILENT_SESSION_REMINDER_SENTINEL} ${message}`;

export type SilentSessionMessageTemplates = {
  mainStalledMessage: string | null;
  subAgentMessageHeader: string | null;
  subAgentMessageFooter: string | null;
};

const formatMinutes = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
};

export class ConfigurableSilentSessionMessageComposer implements SilentSessionMessageComposer {
  constructor(
    private readonly templates: SilentSessionMessageTemplates,
    private readonly fallback: SilentSessionMessageComposer,
  ) {}

  composeMainStalledSection = (mainSilentSeconds: number): string => {
    if (this.templates.mainStalledMessage === null) {
      return this.fallback.composeMainStalledSection(mainSilentSeconds);
    }
    return withReminderSentinel(this.templates.mainStalledMessage);
  };

  composeSubAgentSection = (subAgents: SubAgentActivity[]): string => {
    if (
      this.templates.subAgentMessageHeader === null &&
      this.templates.subAgentMessageFooter === null
    ) {
      return this.fallback.composeSubAgentSection(subAgents);
    }
    const lines = subAgents.map(
      (subAgent) =>
        `- ${subAgent.label}: silent for ${formatMinutes(
          subAgent.silentSeconds,
        )}, running for ${formatMinutes(subAgent.runningSeconds)}`,
    );
    const sections: string[] = [];
    if (this.templates.subAgentMessageHeader !== null) {
      sections.push(this.templates.subAgentMessageHeader);
    }
    sections.push(...lines);
    if (this.templates.subAgentMessageFooter !== null) {
      sections.push(this.templates.subAgentMessageFooter);
    }
    return withReminderSentinel(sections.join('\n'));
  };
}
