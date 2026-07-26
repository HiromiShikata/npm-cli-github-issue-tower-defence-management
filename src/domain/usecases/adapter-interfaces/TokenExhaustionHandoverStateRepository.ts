import { TokenExhaustionHandoverState } from '../../entities/TokenExhaustionHandoverState';

export interface TokenExhaustionHandoverStateRepository {
  load: () => TokenExhaustionHandoverState;
  save: (state: TokenExhaustionHandoverState) => void;
}
