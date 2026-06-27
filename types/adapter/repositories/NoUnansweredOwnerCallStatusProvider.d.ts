import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
export declare class NoUnansweredOwnerCallStatusProvider implements OwnerCallStatusProvider {
    listSessionNamesWithUnansweredOwnerCall: (_transcriptPathBySessionName: Map<string, string>) => Promise<Set<string>>;
}
//# sourceMappingURL=NoUnansweredOwnerCallStatusProvider.d.ts.map