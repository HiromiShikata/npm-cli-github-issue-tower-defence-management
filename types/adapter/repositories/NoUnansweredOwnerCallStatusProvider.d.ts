import { OwnerCallStatusProvider } from '../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
export declare class NoUnansweredOwnerCallStatusProvider implements OwnerCallStatusProvider {
    listSessionNamesWithUnansweredOwnerCall: (_sessionNames: string[]) => Promise<Set<string>>;
}
//# sourceMappingURL=NoUnansweredOwnerCallStatusProvider.d.ts.map