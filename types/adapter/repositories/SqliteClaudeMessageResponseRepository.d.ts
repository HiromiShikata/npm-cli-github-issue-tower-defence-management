import { ClaudeMessageResponse } from '../../domain/entities/ClaudeMessageResponse';
import { ClaudeMessageResponseRepository } from '../../domain/usecases/adapter-interfaces/ClaudeMessageResponseRepository';
export declare const generateUlid: () => string;
export declare class SqliteClaudeMessageResponseRepository implements ClaudeMessageResponseRepository {
    private readonly db;
    private readonly insert;
    constructor(dbPath: string);
    append: (response: ClaudeMessageResponse) => void;
}
//# sourceMappingURL=SqliteClaudeMessageResponseRepository.d.ts.map