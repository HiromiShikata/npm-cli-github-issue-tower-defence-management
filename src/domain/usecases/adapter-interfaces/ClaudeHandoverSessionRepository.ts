import { ClaudeHandoverSession } from '../../entities/ClaudeHandoverSession';

export interface ClaudeHandoverSessionRepository {
  listHandoverSessions: () => ClaudeHandoverSession[];
}
