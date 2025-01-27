import { SpreadsheetRepository } from '../../domain/usecases/adapter-interfaces/SpreadsheetRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
export declare class GoogleSpreadsheetRepository implements SpreadsheetRepository {
    readonly localStorageRepository: LocalStorageRepository;
    keyFile: string;
    constructor(localStorageRepository: LocalStorageRepository, serviceAccountKey?: string);
    getSpreadsheetId: (spreadsheetUrl: string) => string;
    getSheet: (spreadsheetUrl: string, sheetName: string) => Promise<string[][] | null>;
    updateCell: (spreadsheetUrl: string, sheetName: string, row: number, column: number, value: string) => Promise<void>;
    createNewSheetIfNotExists: (spreadsheetUrl: string, sheetName: string) => Promise<void>;
    appendSheetValues: (spreadsheetUrl: string, sheetName: string, values: string[][]) => Promise<void>;
}
//# sourceMappingURL=GoogleSpreadsheetRepository.d.ts.map