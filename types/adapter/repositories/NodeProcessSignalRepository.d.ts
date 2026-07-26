import { ProcessSignalRepository } from '../../domain/usecases/adapter-interfaces/ProcessSignalRepository';
export declare class NodeProcessSignalRepository implements ProcessSignalRepository {
    isProcessAlive: (pid: number) => boolean;
    terminateProcess: (pid: number) => void;
    killProcess: (pid: number) => void;
    private signal;
}
//# sourceMappingURL=NodeProcessSignalRepository.d.ts.map