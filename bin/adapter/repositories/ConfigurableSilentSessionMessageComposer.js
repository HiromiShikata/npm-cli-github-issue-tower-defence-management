"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurableSilentSessionMessageComposer = void 0;
const silentSessionReminderSentinel_1 = require("../../domain/usecases/silentSessionReminderSentinel");
const withReminderSentinel = (message) => message.includes(silentSessionReminderSentinel_1.SILENT_SESSION_REMINDER_SENTINEL)
    ? message
    : `${silentSessionReminderSentinel_1.SILENT_SESSION_REMINDER_SENTINEL} ${message}`;
const formatMinutes = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
};
class ConfigurableSilentSessionMessageComposer {
    constructor(templates, fallback) {
        this.templates = templates;
        this.fallback = fallback;
        this.composeMainStalledSection = (mainSilentSeconds) => {
            if (this.templates.mainStalledMessage === null) {
                return this.fallback.composeMainStalledSection(mainSilentSeconds);
            }
            return withReminderSentinel(this.templates.mainStalledMessage);
        };
        this.composeSubAgentSection = (subAgents, thresholds) => {
            const hasIdleTemplate = this.templates.subAgentIdleMessageHeader !== null ||
                this.templates.subAgentIdleMessageFooter !== null;
            const hasLongRunningTemplate = this.templates.subAgentLongRunningMessageHeader !== null ||
                this.templates.subAgentLongRunningMessageFooter !== null;
            if (!hasIdleTemplate && !hasLongRunningTemplate) {
                return this.fallback.composeSubAgentSection(subAgents, thresholds);
            }
            const idleSubAgents = subAgents.filter((subAgent) => subAgent.silentSeconds >= thresholds.subAgentSilentThresholdSeconds);
            const longRunningSubAgents = subAgents.filter((subAgent) => subAgent.runningSeconds >= thresholds.subAgentRunningThresholdSeconds);
            const sections = [];
            if (idleSubAgents.length > 0 && hasIdleTemplate) {
                sections.push(this.composeIdleSection(idleSubAgents, this.templates.subAgentIdleMessageHeader, this.templates.subAgentIdleMessageFooter));
            }
            else if (idleSubAgents.length > 0) {
                sections.push(this.fallback.composeSubAgentSection(idleSubAgents, {
                    subAgentSilentThresholdSeconds: thresholds.subAgentSilentThresholdSeconds,
                    subAgentRunningThresholdSeconds: Number.POSITIVE_INFINITY,
                }));
            }
            if (longRunningSubAgents.length > 0 && hasLongRunningTemplate) {
                sections.push(this.composeLongRunningSection(longRunningSubAgents, this.templates.subAgentLongRunningMessageHeader, this.templates.subAgentLongRunningMessageFooter));
            }
            else if (longRunningSubAgents.length > 0) {
                sections.push(this.composeLongRunningSection(longRunningSubAgents, null, null));
            }
            return withReminderSentinel(sections.join('\n\n'));
        };
        this.composeIdleSection = (idleSubAgents, header, footer) => {
            const lines = idleSubAgents.map((subAgent) => `- ${subAgent.label}: no output for ${formatMinutes(subAgent.silentSeconds)}`);
            const parts = [];
            if (header !== null) {
                parts.push(header);
            }
            parts.push(...lines);
            if (footer !== null) {
                parts.push(footer);
            }
            return parts.join('\n');
        };
        this.composeLongRunningSection = (longRunningSubAgents, header, footer) => {
            const lines = longRunningSubAgents.map((subAgent) => `- ${subAgent.label}: running for ${formatMinutes(subAgent.runningSeconds)}`);
            const parts = [];
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
}
exports.ConfigurableSilentSessionMessageComposer = ConfigurableSilentSessionMessageComposer;
//# sourceMappingURL=ConfigurableSilentSessionMessageComposer.js.map