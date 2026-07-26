import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
export declare class NoUnansweredOwnerCallStatusProvider implements OwnerCallStatusProvider {
    listUnansweredOwnerCallEpochSecondsBySessionName: (_transcriptPathBySessionName: Map<string, string>) => Promise<Map<string, number>>;
}
//# sourceMappingURL=NoUnansweredOwnerCallStatusProvider.d.ts.map