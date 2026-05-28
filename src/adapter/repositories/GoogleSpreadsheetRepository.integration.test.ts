type SheetState = Map<string, string[][]>;

const sheetStore: SheetState = new Map();

const columnRangeToIndices = (
  range: string,
): { sheetName: string; row: number | null; col: number | null } => {
  const [sheetName, cellPart] = range.split('!');
  if (!cellPart) {
    return { sheetName, row: null, col: null };
  }
  const match = cellPart.match(/^([A-Z]+)(\d+)/);
  if (!match) {
    return { sheetName, row: null, col: null };
  }
  const col = match[1].charCodeAt(0) - 65;
  const row = parseInt(match[2], 10) - 1;
  return { sheetName, row, col };
};

const createMockSheets = () => ({
  spreadsheets: {
    get: jest.fn(async () => ({
      status: 200,
      data: {
        sheets: Array.from(sheetStore.keys()).map((title) => ({
          properties: { title },
        })),
      },
    })),
    values: {
      get: jest.fn(async (params: { spreadsheetId: string; range: string }) => {
        const { sheetName } = columnRangeToIndices(params.range);
        const values = sheetStore.get(sheetName);
        return {
          status: 200,
          data: values && values.length > 0 ? { values } : {},
        };
      }),
      update: jest.fn(
        async (params: {
          spreadsheetId: string;
          range: string;
          valueInputOption: string;
          requestBody: { values: string[][] };
        }) => {
          const { sheetName, row, col } = columnRangeToIndices(params.range);
          const existing = sheetStore.get(sheetName) ?? [];
          if (row !== null && col !== null) {
            while (existing.length <= row) {
              existing.push([]);
            }
            while (existing[row].length <= col) {
              existing[row].push('');
            }
            existing[row][col] = params.requestBody.values[0][0];
          }
          sheetStore.set(sheetName, existing);
          return { status: 200, data: {} };
        },
      ),
      append: jest.fn(
        async (params: {
          spreadsheetId: string;
          range: string;
          valueInputOption: string;
          requestBody: { values: string[][] };
        }) => {
          const { sheetName } = columnRangeToIndices(params.range);
          const existing = sheetStore.get(sheetName) ?? [];
          existing.push(...params.requestBody.values.map((r) => [...r]));
          sheetStore.set(sheetName, existing);
          return { status: 200, data: {} };
        },
      ),
    },
    batchUpdate: jest.fn(
      async (params: {
        spreadsheetId: string;
        requestBody: {
          requests: Array<{ addSheet?: { properties?: { title?: string } } }>;
        };
      }) => {
        params.requestBody.requests.forEach((request) => {
          const title = request.addSheet?.properties?.title;
          if (title && !sheetStore.has(title)) {
            sheetStore.set(title, []);
          }
        });
        return { status: 200, data: {} };
      },
    ),
  },
});

jest.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({})),
    },
    sheets: jest.fn(() => createMockSheets()),
  },
}));

import { GoogleSpreadsheetRepository } from './GoogleSpreadsheetRepository';
import { LocalStorageRepository } from './LocalStorageRepository';

describe('GoogleSpreadsheetRepository integration tests', () => {
  const localStorageRepository = new LocalStorageRepository();
  const spreadsheetUrl =
    'https://docs.google.com/spreadsheets/d/1N_3y0y46v5tHbra5YSm6PldflcsF1bkfeWDdQ3MRuXM/edit?gid=0#gid=0';
  const repository = new GoogleSpreadsheetRepository(
    localStorageRepository,
    'dummy-service-account-key',
  );

  beforeEach(() => {
    sheetStore.clear();
    sheetStore.set('SheetSingleCell', [['test']]);
    sheetStore.set('SheetMultipleRows', [
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  describe('getSheet', () => {
    const testCases: [string, string[][] | null][] = [
      ['SheetUndefined', null],
      ['SheetSingleCell', [['test']]],
      [
        'SheetMultipleRows',
        [
          ['1', '2'],
          ['3', '4'],
        ],
      ],
    ];

    test.each(testCases)(
      'gets sheet %s',
      async (sheetName: string, expected: string[][] | null) => {
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
