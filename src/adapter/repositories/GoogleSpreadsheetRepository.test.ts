import { GoogleSpreadsheetRepository } from './GoogleSpreadsheetRepository';
import { describe, test, expect, jest } from '@jest/globals';
import { LocalStorageRepository } from './LocalStorageRepository';

jest.mock('googleapis');

describe('GoogleSpreadsheetRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  const repository = new GoogleSpreadsheetRepository(localStorageRepository);
  const spreadsheetUrl =
    'https://docs.google.com/spreadsheets/d/1N_3y0y46v5tHbra5YSm6PldflcsF1bkfeWDdQ3MRuXM/edit?gid=0#gid=0';

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
    const testCases: [string, string, string[][] | null][] = [
      ['SheetUndefined', 'Undefined Sheet', null],
      // ['SheetEmpty', 'Empty Sheet', []],
      ['SheetSingleCell', 'Single Cell', [['test']]],
      [
        'SheetMultipleRows',
        'Multiple Rows',
        [
          ['1', '2'],
          ['3', '4'],
        ],
      ],
    ];

    test.each(testCases)(
      'gets sheet %s with %s',
      async (sheetName: string, _: string, expected: string[][] | null) => {
        const result = await repository.getSheet(spreadsheetUrl, sheetName);
        expect(result).toEqual(expected);
      },
    );

    test('returns null for non-existent sheet', async () => {
      const result = await repository.getSheet(
        spreadsheetUrl,
        'NonExistentSheet',
      );
      expect(result).toBeNull();
    });
  });

  describe('updateCell', () => {
    const testCases: [string, number, number, string][] = [
      ['Sheet1', 0, 0, 'First Value'],
      ['Sheet1', 0, 0, 'Updated Value'],
      ['Sheet1', 1, 1, '123'],
      ['Sheet1', 2, 2, 'Test'],
    ];

    test.each(testCases)(
      'updates cell in sheet %s at row %d col %d with value %s',
      async (sheetName: string, row: number, col: number, value: string) => {
        await repository.updateCell(spreadsheetUrl, sheetName, row, col, value);
        const result = await repository.getSheet(spreadsheetUrl, sheetName);
        if (!result) {
          throw new Error('Sheet not found');
        }
        expect(result[row][col]).toBe(value);
      },
    );
  });

  describe('appendSheetValues', () => {
    const testCases: [string[][]][] = [
      [[['Single Row']]],
      [[['Multiple', 'Columns']]],
      [
        [
          ['Row1Col1', 'Row1Col2'],
          ['Row2Col1', 'Row2Col2'],
        ],
      ],
    ];

    test.each(testCases)(
      'appends values %j to sheet',
      async (values: string[][]) => {
        const sheetName = 'AppendTest';
        const initialSheet = await repository.getSheet(
          spreadsheetUrl,
          sheetName,
        );
        const initialLength = initialSheet ? initialSheet.length : 0;

        await repository.appendSheetValues(spreadsheetUrl, sheetName, values);

        const updatedSheet = await repository.getSheet(
          spreadsheetUrl,
          sheetName,
        );
        expect(updatedSheet).not.toBeNull();
        if (!updatedSheet) {
          throw new Error('Sheet not found');
        }
        expect(updatedSheet.length).toBe(initialLength + values.length);

        for (let i = 0; i < values.length; i++) {
          expect(updatedSheet[initialLength + i]).toEqual(values[i]);
        }
      },
    );
  });
});
