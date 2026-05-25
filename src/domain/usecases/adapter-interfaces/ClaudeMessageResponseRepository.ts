import { ClaudeMessageResponse } from '../../entities/ClaudeMessageResponse';

export interface ClaudeMessageResponseRepository {
  append: (response: ClaudeMessageResponse) => void;
}
