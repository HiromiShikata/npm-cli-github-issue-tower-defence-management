"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeSubAgentProcessLister = void 0;
class NodeSubAgentProcessLister {
    constructor(localCommandRunner) {
        this.localCommandRunner = localCommandRunner;
        this.listProcesses = async () => {
            const { stdout, exitCode } = await this.localCommandRunner.runCommand('ps', ['-eo', 'etimes=,args=']);
            if (exitCode !== 0) {
                return [];
            }
            const processes = [];
            for (const line of stdout.split('\n')) {
                const trimmed = line.trim();
                if (trimmed.length === 0) {
                    continue;
                }
                const separatorIndex = trimmed.indexOf(' ');
                if (separatorIndex < 0) {
                    continue;
                }
                const elapsedSeconds = Number(trimmed.slice(0, separatorIndex));
                if (!Number.isFinite(elapsedSeconds)) {
                    continue;
                }
                const commandLine = trimmed.slice(separatorIndex + 1).trim();
                if (commandLine.length === 0) {
                    continue;
                }
                processes.push({ commandLine, elapsedSeconds });
            }
            return processes;
        };
    }
}
exports.NodeSubAgentProcessLister = NodeSubAgentProcessLister;
//# sourceMappingURL=NodeSubAgentProcessLister.js.map