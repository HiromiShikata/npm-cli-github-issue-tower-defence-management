export interface SpreadsheetRepository {
    getSheet: (spreadsheetUrl: string, sheetName: string) => Promise<string[][] | null>;
    updateCell: (spreadsheetUrl: string, sheetName: string, row: number, column: number, value: string) => Promise<void>;
    appendSheetValues: (spreadsheetUrl: string, sheetName: string, values: string[][]) => Promise<void>;
}
//# sourceMappingURL=SpreadsheetRepository.d.ts.map