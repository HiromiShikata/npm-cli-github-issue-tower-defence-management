"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurableSilentSessionMessageComposer = void 0;
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
            return this.templates.mainStalledMessage;
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
            return sections.join('\n');
        };
    }
}
exports.ConfigurableSilentSessionMessageComposer = ConfigurableSilentSessionMessageComposer;
//# sourceMappingURL=ConfigurableSilentSessionMessageComposer.js.map