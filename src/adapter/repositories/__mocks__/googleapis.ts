import { jest } from '@jest/globals';

interface SpreadsheetResponse {
  status: number;
  data: {
    values?: string[][];
    sheets?: Array<{ properties: { title: string } }>;
    spreadsheetId?: string;
    replies?: Array<{ addSheet: { properties: { title: string } } }>;
  };
}

interface GetValuesParams {
  range: string;
}

interface UpdateValuesParams {
  range: string;
  requestBody?: { values?: string[][] };
}

interface BatchUpdateParams {
  requestBody?: {
    requests?: Array<{ addSheet?: { properties: { title: string } } }>;
  };
}

const mockGoogleAuth = jest.fn(() => {
  return {
    getClient() {
      return Promise.resolve({});
    },
  };
});

const mockAuth = {
  GoogleAuth: mockGoogleAuth,
};

// Mock storage for sheet data
const initialSheetData: Array<[string, string[][]]> = [
  ['SheetSingleCell', [['test']]],
  [
    'SheetMultipleRows',
    [
      ['1', '2'],
      ['3', '4'],
    ],
  ],
  [
    'Sheet1',
    Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => '')),
  ],
  ['AppendTest', []],
];

const sheetData = new Map<string, string[][]>(initialSheetData);

const mockSpreadsheets = {
  values: {
    get: jest.fn(function get(
      params: { range: string },
    ): Promise<SpreadsheetResponse> {
      const { range } = params;
          const sheetName = range.split('!')[0];
          const values = sheetData.get(sheetName);
          const response: SpreadsheetResponse = {
            status: 200,
            data: {
              values: values || undefined,
            },
          };
          return Promise.resolve(response);
        },
      ),
    update: jest.fn(function update(
      params: { range: string; requestBody?: { values?: string[][] } },
    ): Promise<SpreadsheetResponse> {
      const { range, requestBody } = params;
          const [sheetName, cellRange] = range.split('!');
          const match = cellRange.match(/([A-Z]+)(\d+)/);
          if (!match) return Promise.reject(new Error('Invalid range'));
          const col = match[1].charCodeAt(0) - 65;
          const row = parseInt(match[2]) - 1;

          let sheetValues = sheetData.get(sheetName) || [];
          if (sheetValues.length === 0) {
            sheetValues = Array.from({ length: 10 }, () =>
              Array.from({ length: 10 }, () => ''),
            );
            sheetData.set(sheetName, sheetValues);
          }

          // Ensure the array is large enough
          while (sheetValues.length <= row) {
            sheetValues.push(Array.from({ length: 10 }, () => ''));
          }
          while (sheetValues[row].length <= col) {
            sheetValues[row].push('');
          }

          if (requestBody?.values?.[0]) {
            sheetValues[row][col] = String(requestBody.values[0][0]);
          }

          return Promise.resolve({
            status: 200,
            data: {},
          });
        },
      ),
    append: jest.fn(function append(
      params: { range: string; requestBody?: { values?: string[][] } },
    ): Promise<SpreadsheetResponse> {
      const { range, requestBody } = params;
          const sheetName = range.split('!')[0];
          if (requestBody?.values) {
            let sheetValues = sheetData.get(sheetName);
            if (!sheetValues) {
              sheetValues = [];
              sheetData.set(sheetName, sheetValues);
            }
            sheetValues.push(
              ...requestBody.values.map((row) => row.map(String)),
            );
          }
          return Promise.resolve({
            status: 200,
            data: {},
          });
        },
      ),
  },
  get: jest.fn().mockImplementation((): Promise<SpreadsheetResponse> => {
    const sheets = Array.from(sheetData.keys()).map((title) => ({
      properties: { title },
    }));
    return Promise.resolve({
      status: 200,
      data: {
        sheets: sheets.length > 0 ? sheets : undefined,
      },
    });
  }),
  batchUpdate: jest.fn(function batchUpdate(
    params: { requestBody?: { requests?: Array<{ addSheet?: { properties: { title: string } } }> } },
  ): Promise<SpreadsheetResponse> {
    const { requestBody } = params;
      if (requestBody?.requests) {
        const addSheetRequest = requestBody.requests.find(
          (request) => request.addSheet,
        );
        if (addSheetRequest?.addSheet) {
          return Promise.resolve({
            status: 200,
            data: {
              spreadsheetId: 'mock-id',
              replies: [
                {
                  addSheet: {
                    properties: addSheetRequest.addSheet.properties,
                  },
                },
              ],
            },
          });
        }
      }
      return Promise.resolve({
        status: 200,
        data: {},
      });
    },
  ),
};

const mockSheets = jest.fn().mockReturnValue({
  spreadsheets: mockSpreadsheets,
});

export const google = {
  auth: mockAuth,
  sheets: mockSheets,
};
