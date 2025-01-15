const mockAuth = {
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockResolvedValue({}),
  })),
};

// Mock storage for sheet data
const sheetData = new Map([
  ['SheetSingleCell', [['test']]],
  ['SheetMultipleRows', [['1', '2'], ['3', '4']]],
  ['Sheet1', Array(10).fill(null).map(() => Array(10).fill(''))],
  ['AppendTest', []],
]);

const mockSpreadsheets = {
  values: {
    get: jest.fn().mockImplementation(({ range }) => {
      const sheetName = range.split('!')[0];
      const values = sheetData.get(sheetName);
      return Promise.resolve({
        status: 200,
        data: {
          values: values || null,
        },
      });
    }),
    update: jest.fn().mockImplementation(({ range, requestBody }) => {
      const [sheetName, cellRange] = range.split('!');
      const match = cellRange.match(/([A-Z]+)(\d+)/);
      if (!match) return Promise.reject(new Error('Invalid range'));
      const col = match[1].charCodeAt(0) - 65;
      const row = parseInt(match[2]) - 1;
      
      let sheetValues = sheetData.get(sheetName);
      if (!sheetValues) {
        sheetValues = Array(10).fill(null).map(() => Array(10).fill(''));
        sheetData.set(sheetName, sheetValues);
      }
      
      // Ensure the array is large enough
      while (sheetValues.length <= row) {
        sheetValues.push(Array(10).fill(''));
      }
      while (sheetValues[row].length <= col) {
        sheetValues[row].push('');
      }
      
      if (requestBody && requestBody.values && requestBody.values[0]) {
        sheetValues[row][col] = requestBody.values[0][0];
      }
      
      return Promise.resolve({
        status: 200,
        data: {},
      });
    }),
    append: jest.fn().mockImplementation(({ range, requestBody }) => {
      const sheetName = range.split('!')[0];
      if (requestBody && requestBody.values) {
        let sheetValues = sheetData.get(sheetName);
        if (!sheetValues) {
          sheetValues = [];
          sheetData.set(sheetName, sheetValues);
        }
        sheetValues.push(...requestBody.values);
      }
      return Promise.resolve({
        status: 200,
        data: {},
      });
    }),
  },
  get: jest.fn().mockImplementation(() => {
    const sheets = Array.from(sheetData.keys()).map(title => ({
      properties: { title },
    }));
    return Promise.resolve({
      status: 200,
      data: {
        sheets,
      },
    });
  }),
  batchUpdate: jest.fn().mockImplementation(({ requestBody }) => {
    if (requestBody && requestBody.requests) {
      const addSheetRequest = requestBody.requests.find((request: { addSheet?: unknown }) => request.addSheet);
      if (addSheetRequest) {
        return Promise.resolve({
          status: 200,
          data: {
            spreadsheetId: 'mock-id',
            replies: [{ addSheet: { properties: addSheetRequest.addSheet.properties } }],
          },
        });
      }
    }
    return Promise.resolve({
      status: 200,
      data: {},
    });
  }),
};

const mockSheets = jest.fn().mockReturnValue({
  spreadsheets: mockSpreadsheets,
});

export const google = {
  auth: mockAuth,
  sheets: mockSheets,
};
