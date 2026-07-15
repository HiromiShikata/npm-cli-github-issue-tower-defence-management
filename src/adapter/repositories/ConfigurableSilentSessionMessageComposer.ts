import { SubAgentActivity } from '../../domain/entities/LiveSessionActivitySnapshot';
import { composeOwnerCallFormatGuidance } from '../../domain/usecases/DefaultSilentSessionMessageComposer';
import {
  SilentSessionMessageComposer,
  SubAgentStallSections,
} from '../../domain/usecases/adapter-interfaces/SilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from '../../domain/usecases/silentSessionReminderSentinel';

const withReminderSentinel = (message: string): string =>
  message.includes(SILENT_SESSION_REMINDER_SENTINEL)
    ? message
    : `${SILENT_SESSION_REMINDER_SENTINEL} ${message}`;

export type SilentSessionMessageTemplates = {
  mainStalledMessage: string | null;
  mainStalledStaleOwnerCallMessage: string | null;
  subAgentIdleMessageHeader: string | null;
  subAgentIdleMessageFooter: string | null;
  subAgentLongRunningMessageHeader: string | null;
  subAgentLongRunningMessageFooter: string | null;
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
    return withReminderSentinel(
      `${this.templates.mainStalledMessage} ${composeOwnerCallFormatGuidance()}`,
    );
  };

  composeMainStalledWithStaleOwnerCallSection = (
    mainSilentSeconds: number,
    unansweredOwnerCallAgeSeconds: number,
  ): string => {
    if (this.templates.mainStalledStaleOwnerCallMessage === null) {
      return this.fallback.composeMainStalledWithStaleOwnerCallSection(
        mainSilentSeconds,
        unansweredOwnerCallAgeSeconds,
      );
    }
    return withReminderSentinel(
      `${this.templates.mainStalledStaleOwnerCallMessage} ${composeOwnerCallFormatGuidance()}`,
    );
  };

  composeSubAgentSection = (stallSections: SubAgentStallSections): string => {
    const hasIdleTemplate =
      this.templates.subAgentIdleMessageHeader !== null ||
      this.templates.subAgentIdleMessageFooter !== null;
    const hasLongRunningTemplate =
      this.templates.subAgentLongRunningMessageHeader !== null ||
      this.templates.subAgentLongRunningMessageFooter !== null;
    if (!hasIdleTemplate && !hasLongRunningTemplate) {
      return this.fallback.composeSubAgentSection(stallSections);
    }

    const { idleSubAgents, longRunningSubAgents } = stallSections;

    const sections: string[] = [];
    if (idleSubAgents.length > 0 && hasIdleTemplate) {
      sections.push(
        this.composeIdleSection(
          idleSubAgents,
          this.templates.subAgentIdleMessageHeader,
          this.templates.subAgentIdleMessageFooter,
        ),
      );
    } else if (idleSubAgents.length > 0) {
      sections.push(
        this.fallback.composeSubAgentSection({
          idleSubAgents,
          longRunningSubAgents: [],
        }),
      );
    }
    if (longRunningSubAgents.length > 0 && hasLongRunningTemplate) {
      sections.push(
        this.composeLongRunningSection(
          longRunningSubAgents,
          this.templates.subAgentLongRunningMessageHeader,
          this.templates.subAgentLongRunningMessageFooter,
        ),
      );
    } else if (longRunningSubAgents.length > 0) {
      sections.push(
        this.composeLongRunningSection(longRunningSubAgents, null, null),
      );
    }
    return withReminderSentinel(sections.join('\n\n'));
  };

  private composeIdleSection = (
    idleSubAgents: SubAgentActivity[],
    header: string | null,
    footer: string | null,
  ): string => {
    const lines = idleSubAgents.map(
      (subAgent) =>
        `- ${subAgent.label}: no output for ${formatMinutes(subAgent.silentSeconds)}`,
    );
    const parts: string[] = [];
    if (header !== null) {
      parts.push(header);
    }
    parts.push(...lines);
    if (footer !== null) {
      parts.push(footer);
    }
    return parts.join('\n');
  };

  private composeLongRunningSection = (
    longRunningSubAgents: SubAgentActivity[],
    header: string | null,
    footer: string | null,
  ): string => {
    const lines = longRunningSubAgents.map(
      (subAgent) =>
        `- ${subAgent.label}: running for ${formatMinutes(subAgent.runningSeconds)}`,
    );
    const parts: string[] = [];
    if (header !== null) {
      parts.push(header);
    }
    parts.push(...lines);
    if (footer !== null) {
      parts.push(footer);
    }
    return parts.join('\n');
  };
}
