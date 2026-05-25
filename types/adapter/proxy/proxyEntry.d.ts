import { ClaudeMessageResponseRepository } from '../../domain/usecases/adapter-interfaces/ClaudeMessageResponseRepository';
declare const extractToken: (authorization: string | string[] | undefined) => string | null;
declare const startProxy: (port: number, claudeMessageResponseRepository?: ClaudeMessageResponseRepository | null) => void;
export { startProxy, extractToken };
//# sourceMappingURL=proxyEntry.d.ts.map