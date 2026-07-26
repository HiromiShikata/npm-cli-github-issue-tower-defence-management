import { TokenExhaustionHandoverState } from '../../entities/TokenExhaustionHandoverState';
export interface TokenExhaustionHandoverStateRepository {
    load: () => TokenExhaustionHandoverState;
    save: (state: TokenExhaustionHandoverState) => void;
}
//# sourceMappingURL=TokenExhaustionHandoverStateRepository.d.ts.map