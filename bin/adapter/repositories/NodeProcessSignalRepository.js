"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeProcessSignalRepository = void 0;
const errorCode = (error) => {
    if (error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'string') {
        return error.code;
    }
    return null;
};
class NodeProcessSignalRepository {
    constructor() {
        this.isProcessAlive = (pid) => {
            try {
                process.kill(pid, 0);
                return true;
            }
            catch (error) {
                return errorCode(error) === 'EPERM';
            }
        };
        this.terminateProcess = (pid) => {
            this.signal(pid, 'SIGTERM');
        };
        this.killProcess = (pid) => {
            this.signal(pid, 'SIGKILL');
        };
        this.signal = (pid, signal) => {
            try {
                process.kill(pid, signal);
            }
            catch (error) {
                if (errorCode(error) === 'ESRCH') {
                    return;
                }
                console.error(`Failed to send ${signal} to pid ${pid}: ${error instanceof Error ? error.message : String(error)}`);
            }
        };
    }
}
exports.NodeProcessSignalRepository = NodeProcessSignalRepository;
//# sourceMappingURL=NodeProcessSignalRepository.js.map