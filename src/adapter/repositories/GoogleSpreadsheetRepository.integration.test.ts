import { GoogleSpreadsheetRepository } from './GoogleSpreadsheetRepository';
import { LocalStorageRepository } from './LocalStorageRepository';

type SheetState = Map<string, string[][]>;

const createInMemorySheetsClient = (initialState: SheetState) => {
  const state: SheetState = new Map(
    Array.from(initialState.entries()).map(([name, rows]) => [
      name,
      rows.map((row) => [...row]),
    ]),
  );

  const columnIndexFromLetter = (letter: string): number =>
    letter.charCodeAt(0) - 65;

  const parseRange = (
    range: string,
  ): { sheetName: string; startRow: number; startCol: number } => {
    const [sheetName, cellPart] = range.split('!');
    if (!cellPart) {
      return { sheetName, startRow: 0, startCol: 0 };
    }
    const [startCell] = cellPart.split(':');
    const match = startCell.match(/^([A-Z]+)([0-9]+)$/);
    if (!match) {
      return { sheetName, startRow: 0, startCol: 0 };
    }
    return {
      sheetName,
      startRow: Number(match[2]) - 1,
      startCol: columnIndexFromLetter(match[1]),
    };
  };

  return {
    spreadsheets: {
      get: async (_params: { spreadsheetId: string }) => ({
        status: 200,
        data: {
          sheets: Array.from(state.keys()).map((title) => ({
            properties: { title },
          })),
        },
      }),
      values: {
        get: async (params: { spreadsheetId: string; range: string }) => {
          const { sheetName } = parseRange(params.range);
          const rows = state.get(sheetName);
          if (!rows || rows.length === 0) {
            return { status: 200, data: {} };
          }
          return { status: 200, data: { values: rows } };
        },
        update: async (params: {
          spreadsheetId: string;
          range: string;
          valueInputOption: string;
          requestBody: { values: string[][] };
        }) => {
          const { sheetName, startRow, startCol } = parseRange(params.range);
          const rows = state.get(sheetName);
          if (!rows) {
            throw new Error(`Sheet ${sheetName} not found for update`);
          }
          params.requestBody.values.forEach((values, rowOffset) => {
            const rowIndex = startRow + rowOffset;
            while (rows.length <= rowIndex) {
              rows.push([]);
            }
            values.forEach((cell, colOffset) => {
              const colIndex = startCol + colOffset;
              while (rows[rowIndex].length <= colIndex) {
                rows[rowIndex].push('');
              }
              rows[rowIndex][colIndex] = cell;
            });
          });
          return { status: 200, data: {} };
        },
        append: async (params: {
          spreadsheetId: string;
          range: string;
          valueInputOption: string;
          requestBody: { values: string[][] };
        }) => {
          const { sheetName } = parseRange(params.range);
          const rows = state.get(sheetName);
          if (!rows) {
            throw new Error(`Sheet ${sheetName} not found for append`);
          }
          params.requestBody.values.forEach((row) => {
            rows.push([...row]);
          });
          return { status: 200, data: {} };
        },
      },
      batchUpdate: async (params: {
        spreadsheetId: string;
        requestBody: {
          requests: Array<{ addSheet?: { properties?: { title?: string } } }>;
        };
      }) => {
        params.requestBody.requests.forEach((request) => {
          const title = request.addSheet?.properties?.title;
          if (title && !state.has(title)) {
            state.set(title, []);
          }
        });
        return { status: 200, data: {} };
      },
    },
  };
};

describe('GoogleSpreadsheetRepository integration tests', () => {
  const localStorageRepository = new LocalStorageRepository();
  const spreadsheetUrl =
    'https://docs.google.com/spreadsheets/d/1N_3y0y46v5tHbra5YSm6PldflcsF1bkfeWDdQ3MRuXM/edit?gid=0#gid=0';

  describe('getSheet', () => {
    const initialState: SheetState = new Map<string, string[][]>([
      ['SheetSingleCell', [['test']]],
      [
        'SheetMultipleRows',
        [
          ['1', '2'],
          ['3', '4'],
        ],
      ],
    ]);

    const repository = new GoogleSpreadsheetRepository(
      localStorageRepository,
      'dummy-service-account-key',
      () => createInMemorySheetsClient(initialState),
    );

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
    const initialState: SheetState = new Map<string, string[][]>([
      ['Sheet1', [['existing']]],
    ]);

    const repository = new GoogleSpreadsheetRepository(
      localStorageRepository,
      'dummy-service-account-key',
      () => createInMemorySheetsClient(initialState),
    );

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
        const repository = new GoogleSpreadsheetRepository(
          localStorageRepository,
          'dummy-service-account-key',
          () => createInMemorySheetsClient(new Map()),
        );
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
