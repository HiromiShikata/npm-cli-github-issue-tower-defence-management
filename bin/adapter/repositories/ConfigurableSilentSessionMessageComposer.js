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
        this.composeOwnerReNotificationSection = (waitingSeconds) => {
            if (this.templates.ownerReNotificationMessage === null) {
                return this.fallback.composeOwnerReNotificationSection(waitingSeconds);
            }
            return withReminderSentinel(this.templates.ownerReNotificationMessage);
        };
        this.composeSubAgentSection = (subAgents) => {
            if (this.templates.subAgentMessageHeader === null &&
                this.templates.subAgentMessageFooter === null) {
                return this.fallback.composeSubAgentSection(subAgents);
            }
            const lines = subAgents.map((subAgent) => `- ${subAgent.label}: silent for ${formatMinutes(subAgent.silentSeconds)}, running for ${formatMinutes(subAgent.runningSeconds)}`);
            const sections = [];
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
}
exports.ConfigurableSilentSessionMessageComposer = ConfigurableSilentSessionMessageComposer;
//# sourceMappingURL=ConfigurableSilentSessionMessageComposer.js.map