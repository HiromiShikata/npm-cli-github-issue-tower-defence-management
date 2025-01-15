const mockAuth = {
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockResolvedValue({}),
  })),
};

const mockSpreadsheets = {
  values: {
    get: jest.fn().mockResolvedValue({
      status: 200,
      data: {
        values: [['test']],
      },
    }),
    update: jest.fn().mockResolvedValue({
      status: 200,
      data: {},
    }),
    append: jest.fn().mockResolvedValue({
      status: 200,
      data: {},
    }),
  },
  get: jest.fn().mockResolvedValue({
    status: 200,
    data: {
      sheets: [{ properties: { title: 'Sheet1' } }],
    },
  }),
};

const mockSheets = jest.fn().mockReturnValue({
  spreadsheets: mockSpreadsheets,
});

export const google = {
  auth: mockAuth,
  sheets: mockSheets,
};
