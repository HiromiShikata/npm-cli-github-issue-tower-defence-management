"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeLocalCommandRunner = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
class NodeLocalCommandRunner {
    async runCommand(program, args, options) {
        const execOptions = {
            encoding: 'utf8',
        };
        if (options?.env) {
            execOptions.env = { ...process.env, ...options.env };
        }
        try {
            const { stdout, stderr } = await execFileAsync(program, args, execOptions);
            return {
                stdout: String(stdout),
                stderr: String(stderr),
                exitCode: 0,
            };
        }
        catch (error) {
            if (error &&
                typeof error === 'object' &&
                'stdout' in error &&
                'stderr' in error &&
                'code' in error) {
                return {
                    stdout: String(error.stdout),
                    stderr: String(error.stderr),
                    exitCode: typeof error.code === 'number' ? error.code : 1,
                };
            }
            throw error;
        }
    }
}
exports.NodeLocalCommandRunner = NodeLocalCommandRunner;
//# sourceMappingURL=NodeLocalCommandRunner.js.map