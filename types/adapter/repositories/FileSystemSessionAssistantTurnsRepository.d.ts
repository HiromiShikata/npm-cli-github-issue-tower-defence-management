import { SessionAssistantTurnsRepository } from '../../domain/usecases/adapter-interfaces/SessionAssistantTurnsRepository';
export declare const DEFAULT_TRANSCRIPT_TAIL_BYTES = 3000000;
export declare class FileSystemSessionAssistantTurnsRepository implements SessionAssistantTurnsRepository {
    private readonly tailBytes;
    constructor(tailBytes?: number);
    listRecentAssistantTurnsBySessionName: (transcriptPathBySessionName: Map<string, string>, maxTurnsPerSession: number) => Promise<Map<string, string[]>>;
    private readRecentAssistantTurns;
    private readTailLines;
}
//# sourceMappingURL=FileSystemSessionAssistantTurnsRepository.d.ts.map