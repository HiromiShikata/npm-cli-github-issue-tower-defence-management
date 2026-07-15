import { RefusalTailStatusProvider } from '../../domain/usecases/adapter-interfaces/RefusalTailStatusProvider';
export declare class TranscriptRefusalTailStatusProvider implements RefusalTailStatusProvider {
    listRefusalTailedSessionNames: (transcriptPathBySessionName: Map<string, string>) => Promise<Set<string>>;
    private isTranscriptRefusalTailed;
}
//# sourceMappingURL=TranscriptRefusalTailStatusProvider.d.ts.map