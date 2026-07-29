import dotenv from 'dotenv';
import { google } from 'googleapis';
import { GoogleSpreadsheetRepository } from './GoogleSpreadsheetRepository';
import { LocalStorageRepository } from './LocalStorageRepository';

dotenv.config();

const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

const integrationTestIsRequired =
  process.env.GOOGLE_SHEETS_INTEGRATION_REQUIRED === 'true';

const credentialIsMissingWhileRequired =
  integrationTestIsRequired && !GOOGLE_SERVICE_ACCOUNT_KEY;

describe('GoogleSpreadsheetRepository integration test credential', () => {
  test('is available whenever these integration tests are required to run', () => {
    expect(
      credentialIsMissingWhileRequired
        ? 'GOOGLE_SERVICE_ACCOUNT_KEY is absent while GOOGLE_SHEETS_INTEGRATION_REQUIRED is true, so the Google Sheets integration tests would silently skip and prove nothing'
        : 'the Google Sheets integration tests either hold their credential or are not required in this context',
    ).toBe(
      'the Google Sheets integration tests either hold their credential or are not required in this context',
    );
  });
});

const describeWhenCredentials = GOOGLE_SERVICE_ACCOUNT_KEY
  ? describe
  : describe.skip;

describeWhenCredentials('GoogleSpreadsheetRepository integration tests', () => {
  jest.setTimeout(60 * 1000);
  jest.retryTimes(3, { logErrorsBeforeRetry: true });

  const localStorageRepository = new LocalStorageRepository();
  const spreadsheetId = '1N_3y0y46v5tHbra5YSm6PldflcsF1bkfeWDdQ3MRuXM';
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=0#gid=0`;
  const repository = new GoogleSpreadsheetRepository(
    localStorageRepository,
    GOOGLE_SERVICE_ACCOUNT_KEY,
  );

  const scratchSheetNamePrefix = 'IntegrationScratch_';
  const scratchSheetName = `${scratchSheetNamePrefix}${Date.now()}_${process.pid}`;
  const abandonedScratchSheetAgeMilliseconds = 2 * 60 * 60 * 1000;
  const rawSheetsClientKeyFile =
    './tmp/integration-test-service-account-key.json';

  const createRawSheetsClient = () => {
    if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_KEY is required to run the Google Sheets integration tests',
      );
    }
    localStorageRepository.write(
      rawSheetsClientKeyFile,
      GOOGLE_SERVICE_ACCOUNT_KEY,
    );
    const auth = new google.auth.GoogleAuth({
      keyFile: rawSheetsClientKeyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  };

  const listSheetTitles = async (): Promise<string[]> => {
    const response = await createRawSheetsClient().spreadsheets.get({
      spreadsheetId,
    });
    return (response.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => typeof title === 'string');
  };

  const deleteSheetsByTitle = async (titles: string[]): Promise<void> => {
    if (titles.length === 0) {
      return;
    }
    const sheetsClient = createRawSheetsClient();
    const response = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const sheetIds = (response.data.sheets ?? [])
      .filter((sheet) => {
        const title = sheet.properties?.title;
        return typeof title === 'string' && titles.includes(title);
      })
      .map((sheet) => sheet.properties?.sheetId)
      .filter((sheetId): sheetId is number => typeof sheetId === 'number');
    if (sheetIds.length === 0) {
      return;
    }
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: sheetIds.map((sheetId) => ({ deleteSheet: { sheetId } })),
      },
    });
  };

  const findAbandonedScratchSheetTitles = async (): Promise<string[]> => {
    const titles = await listSheetTitles();
    return titles
      .filter((title) => title.startsWith(scratchSheetNamePrefix))
      .filter((title) => title !== scratchSheetName)
      .filter((title) => {
        const createdAtMilliseconds = Number(
          title.slice(scratchSheetNamePrefix.length).split('_')[0],
        );
        return (
          Number.isFinite(createdAtMilliseconds) &&
          Date.now() - createdAtMilliseconds >
            abandonedScratchSheetAgeMilliseconds
        );
      });
  };

  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    const abandonedTitles = await findAbandonedScratchSheetTitles();
    await deleteSheetsByTitle([scratchSheetName, ...abandonedTitles]);
  });

  describe('getSpreadsheetId', () => {
    test('extracts the spreadsheet id from the spreadsheet url', () => {
      expect(repository.getSpreadsheetId(spreadsheetUrl)).toBe(spreadsheetId);
    });
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

  describe('createNewSheetIfNotExists', () => {
    test('creates the sheet and stays idempotent on a second call', async () => {
      await deleteSheetsByTitle([scratchSheetName]);
      expect(await listSheetTitles()).not.toContain(scratchSheetName);

      await repository.createNewSheetIfNotExists(
        spreadsheetUrl,
        scratchSheetName,
      );
      expect(await listSheetTitles()).toContain(scratchSheetName);
      expect(
        await repository.getSheet(spreadsheetUrl, scratchSheetName),
      ).toBeNull();

      await repository.createNewSheetIfNotExists(
        spreadsheetUrl,
        scratchSheetName,
      );
      const titlesAfterSecondCall = await listSheetTitles();
      expect(
        titlesAfterSecondCall.filter((title) => title === scratchSheetName)
          .length,
      ).toBe(1);
    });
  });

  describe('appendSheetValues', () => {
    test('appends rows to a sheet it creates and keeps the earlier rows', async () => {
      await deleteSheetsByTitle([scratchSheetName]);

      await repository.appendSheetValues(spreadsheetUrl, scratchSheetName, [
        ['firstRowFirstColumn', 'firstRowSecondColumn'],
      ]);
      expect(
        await repository.getSheet(spreadsheetUrl, scratchSheetName),
      ).toEqual([['firstRowFirstColumn', 'firstRowSecondColumn']]);

      await repository.appendSheetValues(spreadsheetUrl, scratchSheetName, [
        ['secondRowFirstColumn', 'secondRowSecondColumn'],
        ['thirdRowFirstColumn', 'thirdRowSecondColumn'],
      ]);
      expect(
        await repository.getSheet(spreadsheetUrl, scratchSheetName),
      ).toEqual([
        ['firstRowFirstColumn', 'firstRowSecondColumn'],
        ['secondRowFirstColumn', 'secondRowSecondColumn'],
        ['thirdRowFirstColumn', 'thirdRowSecondColumn'],
      ]);
    });
  });

  describe('updateCell', () => {
    test('creates the sheet when missing, writes a cell, and overwrites it', async () => {
      await deleteSheetsByTitle([scratchSheetName]);

      await repository.updateCell(
        spreadsheetUrl,
        scratchSheetName,
        0,
        0,
        'firstValue',
      );
      expect(
        await repository.getSheet(spreadsheetUrl, scratchSheetName),
      ).toEqual([['firstValue']]);

      await repository.updateCell(
        spreadsheetUrl,
        scratchSheetName,
        0,
        0,
        'updatedValue',
      );
      expect(
        await repository.getSheet(spreadsheetUrl, scratchSheetName),
      ).toEqual([['updatedValue']]);

      await repository.updateCell(
        spreadsheetUrl,
        scratchSheetName,
        2,
        2,
        'thirdRowThirdColumn',
      );
      const sheet = await repository.getSheet(spreadsheetUrl, scratchSheetName);
      if (!sheet) {
        throw new Error('Sheet not found');
      }
      expect(sheet[0][0]).toBe('updatedValue');
      expect(sheet[2][2]).toBe('thirdRowThirdColumn');
    });
  });
});
