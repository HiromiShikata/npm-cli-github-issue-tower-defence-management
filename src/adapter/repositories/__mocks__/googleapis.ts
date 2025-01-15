const mockAuth = {
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockResolvedValue({}),
  })),
};

// Mock storage for sheet data
const sheetData = {
  values: Array(10).fill(null).map(() => Array(10).fill('')),
};

const mockSpreadsheets = {
  values: {
    get: jest.fn().mockImplementation(({ range }) => Promise.resolve({
      status: 200,
      data: {
        values: sheetData.values,
      },
    })),
    update: jest.fn().mockImplementation(({ range, requestBody }) => {
      const match = range.match(/([A-Z]+)(\d+)/);
      if (!match) return Promise.reject(new Error('Invalid range'));
      const col = match[1].charCodeAt(0) - 65;
      const row = parseInt(match[2]) - 1;
      if (requestBody && requestBody.values && requestBody.values[0]) {
        sheetData.values[row][col] = requestBody.values[0][0];
      }
      return Promise.resolve({
        status: 200,
        data: {},
      });
    }),
    append: jest.fn().mockImplementation(({ requestBody }) => {
      if (requestBody && requestBody.values) {
        sheetData.values.push(...requestBody.values);
      }
      return Promise.resolve({
        status: 200,
        data: {},
      });
    }),
  },
  get: jest.fn().mockResolvedValue({
    status: 200,
    data: {
      sheets: [{ properties: { title: 'Sheet1' } }],
    },
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
