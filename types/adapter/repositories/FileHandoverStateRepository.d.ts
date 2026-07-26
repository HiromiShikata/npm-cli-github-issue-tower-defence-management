import { TokenExhaustionHandoverState } from '../../domain/entities/TokenExhaustionHandoverState';
import { TokenExhaustionHandoverStateRepository } from '../../domain/usecases/adapter-interfaces/TokenExhaustionHandoverStateRepository';
export declare const defaultHandoverStateFilePath: () => string;
export declare class FileHandoverStateRepository implements TokenExhaustionHandoverStateRepository {
    private readonly filePath;
    constructor(filePath?: string);
    load: () => TokenExhaustionHandoverState;
    save: (state: TokenExhaustionHandoverState) => void;
    private parseEntries;
}
//# sourceMappingURL=FileHandoverStateRepository.d.ts.map