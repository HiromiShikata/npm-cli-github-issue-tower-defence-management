import { SpreadsheetRepository } from '../../domain/usecases/adapter-interfaces/SpreadsheetRepository';
import { google } from 'googleapis';
import { LocalStorageRepository } from './LocalStorageRepository';
import dotenv from 'dotenv';
dotenv.config();

export class GoogleSpreadsheetRepository implements SpreadsheetRepository {
  keyFile = './tmp/service-account-key.json';

  constructor(
    readonly localStorageRepository: LocalStorageRepository,
    serviceAccountKey: string = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      'dummy',
  ) {
    this.localStorageRepository.write(this.keyFile, serviceAccountKey);
  }

  getSpreadsheetId = (spreadsheetUrl: string): string => {
    const url = new URL(spreadsheetUrl);
    return url.pathname.split('/')[3];
  };
  getSheet = async (
    spreadsheetUrl: string,
    sheetName: string,
  ): Promise<string[][] | null> => {
    const auth = new google.auth.GoogleAuth({
      keyFile: this.keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
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
    const auth = new google.auth.GoogleAuth({
      keyFile: this.keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = this.getSpreadsheetId(spreadsheetUrl);
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
  appendSheetValues = async (
    spreadsheetUrl: string,
    sheetName: string,
    values: string[][],
  ): Promise<void> => {
    const auth = new google.auth.GoogleAuth({
      keyFile: this.keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = this.getSpreadsheetId(spreadsheetUrl);
    const sheet = await this.getSheet(spreadsheetUrl, sheetName);
    if (sheet === null) {
      await sheets.spreadsheets.batchUpdate({
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
    }
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
