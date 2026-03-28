import { GoogleSpreadsheetRepository } from './GoogleSpreadsheetRepository';
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { LocalStorageRepository } from './LocalStorageRepository';
import { sheets_v4 } from 'googleapis';

describe('GoogleSpreadsheetRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  const spreadsheetUrl =
    'https://docs.google.com/spreadsheets/d/1N_3y0y46v5tHbra5YSm6PldflcsF1bkfeWDdQ3MRuXM/edit?gid=0#gid=0';

  const mockSpreadsheetsGet = jest.fn<() => Promise<unknown>>();
  const mockSpreadsheetsValuesGet = jest.fn<() => Promise<unknown>>();
  const mockSpreadsheetsValuesUpdate = jest.fn<() => Promise<unknown>>();
  const mockSpreadsheetsValuesAppend = jest.fn<() => Promise<unknown>>();
  const mockSpreadsheetsBatchUpdate = jest.fn<() => Promise<unknown>>();

  const mockSheetsClient = {
    spreadsheets: {
      get: mockSpreadsheetsGet,
      values: {
        get: mockSpreadsheetsValuesGet,
        update: mockSpreadsheetsValuesUpdate,
        append: mockSpreadsheetsValuesAppend,
      },
      batchUpdate: mockSpreadsheetsBatchUpdate,
    },
  } as unknown as sheets_v4.Sheets;

  const repository = new GoogleSpreadsheetRepository(
    localStorageRepository,
    'dummy-service-account-key',
    () => mockSheetsClient,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSpreadsheetId', () => {
    const testCases: [string, string][] = [
      [
        'https://docs.google.com/spreadsheets/d/1234567890abcdef/edit#gid=0',
        '1234567890abcdef',
      ],
      [
        'https://docs.google.com/spreadsheets/d/abcdef1234567890/edit',
        'abcdef1234567890',
      ],
    ];

    test.each(testCases)(
      'given %s returns %s',
      (input: string, expected: string) => {
        expect(repository.getSpreadsheetId(input)).toBe(expected);
      },
    );
  });

  describe('getSheet', () => {
    test('returns null when sheet is not in spreadsheet', async () => {
      mockSpreadsheetsGet.mockResolvedValue({
        status: 200,
        data: { sheets: [] },
      });

      const result = await repository.getSheet(
        spreadsheetUrl,
        'NonExistentSheet',
      );

      expect(result).toBeNull();
    });

    test('returns null when sheet name does not match', async () => {
      mockSpreadsheetsGet.mockResolvedValue({
        status: 200,
        data: {
          sheets: [{ properties: { title: 'OtherSheet' } }],
        },
      });

      const result = await repository.getSheet(
        spreadsheetUrl,
        'SheetUndefined',
      );

      expect(result).toBeNull();
    });

    test('returns single cell value', async () => {
      mockSpreadsheetsGet.mockResolvedValue({
        status: 200,
        data: {
          sheets: [{ properties: { title: 'SheetSingleCell' } }],
        },
      });
      mockSpreadsheetsValuesGet.mockResolvedValue({
        status: 200,
        data: { values: [['test']] },
      });

      const result = await repository.getSheet(
        spreadsheetUrl,
        'SheetSingleCell',
      );

      expect(result).toEqual([['test']]);
    });

    test('returns multiple rows', async () => {
      mockSpreadsheetsGet.mockResolvedValue({
        status: 200,
        data: {
          sheets: [{ properties: { title: 'SheetMultipleRows' } }],
        },
      });
      mockSpreadsheetsValuesGet.mockResolvedValue({
        status: 200,
        data: {
          values: [
            ['1', '2'],
            ['3', '4'],
          ],
        },
      });

      const result = await repository.getSheet(
        spreadsheetUrl,
        'SheetMultipleRows',
      );

      expect(result).toEqual([
        ['1', '2'],
        ['3', '4'],
      ]);
    });

    test('returns null when sheet has no values', async () => {
      mockSpreadsheetsGet.mockResolvedValue({
        status: 200,
        data: {
          sheets: [{ properties: { title: 'EmptySheet' } }],
        },
      });
      mockSpreadsheetsValuesGet.mockResolvedValue({
        status: 200,
        data: {},
      });

      const result = await repository.getSheet(spreadsheetUrl, 'EmptySheet');

      expect(result).toBeNull();
    });

    test('converts non-string cell values to strings', async () => {
      mockSpreadsheetsGet.mockResolvedValue({
        status: 200,
        data: {
          sheets: [{ properties: { title: 'MixedTypes' } }],
        },
      });
      mockSpreadsheetsValuesGet.mockResolvedValue({
        status: 200,
        data: { values: [[1, true, 'text']] },
      });

      const result = await repository.getSheet(spreadsheetUrl, 'MixedTypes');

      expect(result).toEqual([['1', 'true', 'text']]);
    });
  });

  describe('updateCell', () => {
    beforeEach(() => {
      mockSpreadsheetsGet.mockResolvedValue({
        status: 200,
        data: {
          sheets: [{ properties: { title: 'Sheet1' } }],
        },
      });
      mockSpreadsheetsValuesGet.mockResolvedValue({
        status: 200,
        data: { values: [['existing']] },
      });
      mockSpreadsheetsValuesUpdate.mockResolvedValue({
        status: 200,
        data: {},
      });
    });

    const testCases: [string, number, number, string, string][] = [
      ['Sheet1', 0, 0, 'First Value', 'Sheet1!A1'],
      ['Sheet1', 0, 0, 'Updated Value', 'Sheet1!A1'],
      ['Sheet1', 1, 1, '123', 'Sheet1!B2'],
      ['Sheet1', 2, 2, 'Test', 'Sheet1!C3'],
    ];

    test.each(testCases)(
      'updates cell in sheet %s at row %d col %d with value %s using range %s',
      async (sheetName, row, col, value, expectedRange) => {
        await repository.updateCell(spreadsheetUrl, sheetName, row, col, value);

        expect(mockSpreadsheetsValuesUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            range: expectedRange,
            valueInputOption: 'RAW',
            requestBody: { values: [[value]] },
          }),
        );
      },
    );
  });

  describe('appendSheetValues', () => {
    test('appends to existing sheet starting after last row', async () => {
      mockSpreadsheetsGet.mockResolvedValue({
        status: 200,
        data: {
          sheets: [{ properties: { title: 'AppendTest' } }],
        },
      });
      mockSpreadsheetsValuesGet.mockResolvedValue({
        status: 200,
        data: { values: [['Row1'], ['Row2']] },
      });
      mockSpreadsheetsValuesAppend.mockResolvedValue({
        status: 200,
        data: {},
      });

      await repository.appendSheetValues(spreadsheetUrl, 'AppendTest', [
        ['NewRow'],
      ]);

      expect(mockSpreadsheetsValuesAppend).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'AppendTest!A3:A',
          valueInputOption: 'RAW',
          requestBody: { values: [['NewRow']] },
        }),
      );
    });

    test('appends multiple rows with correct values', async () => {
      mockSpreadsheetsGet.mockResolvedValue({
        status: 200,
        data: {
          sheets: [{ properties: { title: 'AppendTest' } }],
        },
      });
      mockSpreadsheetsValuesGet.mockResolvedValue({
        status: 200,
        data: { values: [['Existing']] },
      });
      mockSpreadsheetsValuesAppend.mockResolvedValue({
        status: 200,
        data: {},
      });

      const newValues = [
        ['Row1Col1', 'Row1Col2'],
        ['Row2Col1', 'Row2Col2'],
      ];
      await repository.appendSheetValues(
        spreadsheetUrl,
        'AppendTest',
        newValues,
      );

      expect(mockSpreadsheetsValuesAppend).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: { values: newValues },
        }),
      );
    });

    test('creates new sheet via batchUpdate when sheet does not exist', async () => {
      mockSpreadsheetsGet.mockResolvedValue({
        status: 200,
        data: { sheets: [] },
      });
      mockSpreadsheetsBatchUpdate.mockResolvedValue({
        status: 200,
        data: {},
      });
      mockSpreadsheetsValuesGet.mockResolvedValue({
        status: 200,
        data: {},
      });
      mockSpreadsheetsValuesAppend.mockResolvedValue({
        status: 200,
        data: {},
      });

      await repository.appendSheetValues(spreadsheetUrl, 'NewSheet', [['Row']]);

      expect(mockSpreadsheetsBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            requests: [{ addSheet: { properties: { title: 'NewSheet' } } }],
          },
        }),
      );
      expect(mockSpreadsheetsValuesAppend).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'NewSheet!A1:A',
        }),
      );
    });
  });
});
