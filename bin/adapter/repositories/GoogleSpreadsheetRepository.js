"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleSpreadsheetRepository = void 0;
const googleapis_1 = require("googleapis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class GoogleSpreadsheetRepository {
    constructor(localStorageRepository, serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
        'dummy') {
        this.localStorageRepository = localStorageRepository;
        this.keyFile = './tmp/service-account-key.json';
        this.getSpreadsheetId = (spreadsheetUrl) => {
            const url = new URL(spreadsheetUrl);
            return url.pathname.split('/')[3];
        };
        this.getSheet = async (spreadsheetUrl, sheetName) => {
            const auth = new googleapis_1.google.auth.GoogleAuth({
                keyFile: this.keyFile,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
            const spreadsheetId = this.getSpreadsheetId(spreadsheetUrl);
            const responseSheet = await sheets.spreadsheets.get({
                spreadsheetId,
            });
            if (responseSheet.status !== 200) {
                throw new Error(`Failed to get sheet: ${responseSheet.status}. ${JSON.stringify(responseSheet.data)}`);
            }
            const sheet = responseSheet.data.sheets?.find((s) => s.properties?.title === sheetName);
            if (!sheet) {
                return null;
            }
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: sheetName,
            });
            if (response.status !== 200) {
                throw new Error(`Failed to get sheet: ${response.status}. ${JSON.stringify(response.data)}`);
            }
            if (!response.data.values) {
                return null;
            }
            return response.data.values.map((row) => row.map((cell) => String(cell)));
        };
        this.updateCell = async (spreadsheetUrl, sheetName, row, column, value) => {
            const auth = new googleapis_1.google.auth.GoogleAuth({
                keyFile: this.keyFile,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
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
                throw new Error(`Failed to update cell: ${response.status}. ${JSON.stringify(response.data)}`);
            }
        };
        this.createNewSheetIfNotExists = async (spreadsheetUrl, sheetName) => {
            const auth = new googleapis_1.google.auth.GoogleAuth({
                keyFile: this.keyFile,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
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
                throw new Error(`Failed to create sheet: ${response.status}. ${JSON.stringify(response.data)}`);
            }
        };
        this.appendSheetValues = async (spreadsheetUrl, sheetName, values) => {
            const auth = new googleapis_1.google.auth.GoogleAuth({
                keyFile: this.keyFile,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
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
                throw new Error(`Failed to append values: ${response.status}. ${JSON.stringify(response.data)}`);
            }
        };
        this.localStorageRepository.write(this.keyFile, serviceAccountKey);
    }
}
exports.GoogleSpreadsheetRepository = GoogleSpreadsheetRepository;
//# sourceMappingURL=GoogleSpreadsheetRepository.js.map