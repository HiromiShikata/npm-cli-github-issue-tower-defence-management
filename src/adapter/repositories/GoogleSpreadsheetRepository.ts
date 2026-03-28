import { SpreadsheetRepository } from '../../domain/usecases/adapter-interfaces/SpreadsheetRepository';
import { google } from 'googleapis';
import { LocalStorageRepository } from './LocalStorageRepository';
import dotenv from 'dotenv';
dotenv.config();

interface SheetsApiClient {
  spreadsheets: {
    get(params: { spreadsheetId: string }): Promise<{
      status: number;
      data: {
        sheets?: Array<{
          properties?: { title?: string | null } | null;
        }> | null;
      };
    }>;
    values: {
      get(params: { spreadsheetId: string; range: string }): Promise<{
        status: number;
        data: { values?: unknown[][] | null };
      }>;
      update(params: {
        spreadsheetId: string;
        range: string;
        valueInputOption: string;
        requestBody: { values: string[][] };
      }): Promise<{ status: number; data: unknown }>;
      append(params: {
        spreadsheetId: string;
        range: string;
        valueInputOption: string;
        requestBody: { values: string[][] };
      }): Promise<{ status: number; data: unknown }>;
    };
    batchUpdate(params: {
      spreadsheetId: string;
      requestBody: {
        requests: Array<{ addSheet?: { properties?: { title?: string } } }>;
      };
    }): Promise<{ status: number; data: unknown }>;
  };
}

export class GoogleSpreadsheetRepository implements SpreadsheetRepository {
  keyFile = './tmp/service-account-key.json';
  private readonly sheetsClientFactory: () => SheetsApiClient;

  constructor(
    readonly localStorageRepository: LocalStorageRepository,
    serviceAccountKey: string = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      'dummy',
    sheetsClientFactory?: () => SheetsApiClient,
  ) {
    this.localStorageRepository.write(this.keyFile, serviceAccountKey);
    this.sheetsClientFactory =
      sheetsClientFactory ??
      (() => {
        const auth = new google.auth.GoogleAuth({
          keyFile: this.keyFile,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const googleSheets = google.sheets({ version: 'v4', auth });
        return {
          spreadsheets: {
            get: (params: { spreadsheetId: string }) =>
              googleSheets.spreadsheets.get(params),
            values: {
              get: (params: { spreadsheetId: string; range: string }) =>
                googleSheets.spreadsheets.values.get(params),
              update: (params: {
                spreadsheetId: string;
                range: string;
                valueInputOption: string;
                requestBody: { values: string[][] };
              }) => googleSheets.spreadsheets.values.update(params),
              append: (params: {
                spreadsheetId: string;
                range: string;
                valueInputOption: string;
                requestBody: { values: string[][] };
              }) => googleSheets.spreadsheets.values.append(params),
            },
            batchUpdate: (params: {
              spreadsheetId: string;
              requestBody: {
                requests: Array<{
                  addSheet?: { properties?: { title?: string } };
                }>;
              };
            }) => googleSheets.spreadsheets.batchUpdate(params),
          },
        };
      });
  }

  getSpreadsheetId = (spreadsheetUrl: string): string => {
    const url = new URL(spreadsheetUrl);
    return url.pathname.split('/')[3];
  };
  getSheet = async (
    spreadsheetUrl: string,
    sheetName: string,
  ): Promise<string[][] | null> => {
    const sheets = this.sheetsClientFactory();
    const spreadsheetId = this.getSpreadsheetId(spreadsheetUrl);
    const responseSheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    if (responseSheet.status !== 200) {
      throw new Error(
        `Failed to get sheet: ${responseSheet.status}. ${JSON.stringify(responseSheet.data)}`,
      );
    }
    const sheet = responseSheet.data.sheets?.find(
      (s) => s.properties?.title === sheetName,
    );
    if (!sheet) {
      return null;
    }
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetName,
    });
    if (response.status !== 200) {
      throw new Error(
        `Failed to get sheet: ${response.status}. ${JSON.stringify(response.data)}`,
      );
    }
    if (!response.data.values) {
      return null;
    }
    return response.data.values.map((row) => row.map((cell) => String(cell)));
  };
  updateCell = async (
    spreadsheetUrl: string,
    sheetName: string,
    row: number,
    column: number,
    value: string,
  ): Promise<void> => {
    const sheets = this.sheetsClientFactory();
    const spreadsheetId = this.getSpreadsheetId(spreadsheetUrl);
    await this.createNewSheetIfNotExists(spreadsheetUrl, sheetName);
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!${String.fromCharCode(65 + column)}${row + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[value]],
      },
    });
    if (response.status !== 200) {
      throw new Error(
        `Failed to update cell: ${response.status}. ${JSON.stringify(response.data)}`,
      );
    }
  };
  createNewSheetIfNotExists = async (
    spreadsheetUrl: string,
    sheetName: string,
  ): Promise<void> => {
    const sheets = this.sheetsClientFactory();
    const spreadsheetId = this.getSpreadsheetId(spreadsheetUrl);
    const sheet = await this.getSheet(spreadsheetUrl, sheetName);
    if (sheet !== null) {
      return;
    }
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });
    if (response.status !== 200) {
      throw new Error(
        `Failed to create sheet: ${response.status}. ${JSON.stringify(response.data)}`,
      );
    }
  };

  appendSheetValues = async (
    spreadsheetUrl: string,
    sheetName: string,
    values: string[][],
  ): Promise<void> => {
    const sheets = this.sheetsClientFactory();
    const spreadsheetId = this.getSpreadsheetId(spreadsheetUrl);
    await this.createNewSheetIfNotExists(spreadsheetUrl, sheetName);
    const sheet = await this.getSheet(spreadsheetUrl, sheetName);
    const range = `${sheetName}!A${sheet ? sheet.length + 1 : 1}:A`;
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });
    if (response.status !== 200) {
      throw new Error(
        `Failed to append values: ${response.status}. ${JSON.stringify(response.data)}`,
      );
    }
  };
}
