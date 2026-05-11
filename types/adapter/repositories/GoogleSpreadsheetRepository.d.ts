import { SpreadsheetRepository } from '../../domain/usecases/adapter-interfaces/SpreadsheetRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
interface SheetsApiClient {
    spreadsheets: {
        get(params: {
            spreadsheetId: string;
        }): Promise<{
            status: number;
            data: {
                sheets?: Array<{
                    properties?: {
                        title?: string | null;
                    } | null;
                }> | null;
            };
        }>;
        values: {
            get(params: {
                spreadsheetId: string;
                range: string;
            }): Promise<{
                status: number;
                data: {
                    values?: unknown[][] | null;
                };
            }>;
            update(params: {
                spreadsheetId: string;
                range: string;
                valueInputOption: string;
                requestBody: {
                    values: string[][];
                };
            }): Promise<{
                status: number;
                data: unknown;
            }>;
            append(params: {
                spreadsheetId: string;
                range: string;
                valueInputOption: string;
                requestBody: {
                    values: string[][];
                };
            }): Promise<{
                status: number;
                data: unknown;
            }>;
        };
        batchUpdate(params: {
            spreadsheetId: string;
            requestBody: {
                requests: Array<{
                    addSheet?: {
                        properties?: {
                            title?: string;
                        };
                    };
                }>;
            };
        }): Promise<{
            status: number;
            data: unknown;
        }>;
    };
}
export declare class GoogleSpreadsheetRepository implements SpreadsheetRepository {
    readonly localStorageRepository: LocalStorageRepository;
    keyFile: string;
    private readonly sheetsClient;
    constructor(localStorageRepository: LocalStorageRepository, serviceAccountKey?: string, sheetsClientFactory?: () => SheetsApiClient);
    getSpreadsheetId: (spreadsheetUrl: string) => string;
    getSheet: (spreadsheetUrl: string, sheetName: string) => Promise<string[][] | null>;
    updateCell: (spreadsheetUrl: string, sheetName: string, row: number, column: number, value: string) => Promise<void>;
    createNewSheetIfNotExists: (spreadsheetUrl: string, sheetName: string) => Promise<void>;
    appendSheetValues: (spreadsheetUrl: string, sheetName: string, values: string[][]) => Promise<void>;
}
export {};
//# sourceMappingURL=GoogleSpreadsheetRepository.d.ts.map