import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadTokenEntries, loadTokens } from './TokenListLoader';

describe('loadTokenEntries', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-entries-loader-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return entries with name and token', () => {
    const filePath = path.join(tempDir, 'tokens.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify([
        { name: 'alice', token: 'token-a' },
        { name: 'bob', token: 'token-b' },
      ]),
    );
    expect(loadTokenEntries(filePath)).toEqual([
      { name: 'alice', token: 'token-a' },
      { name: 'bob', token: 'token-b' },
    ]);
  });

  it('should assign a unique positional name when name is absent from entry', () => {
    const filePath = path.join(tempDir, 'tokens.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify([{ token: 'token-a' }, { token: 'token-b' }]),
    );
    expect(loadTokenEntries(filePath)).toEqual([
      { name: 'token-1', token: 'token-a' },
      { name: 'token-2', token: 'token-b' },
    ]);
  });

  it('should return null when file does not exist', () => {
    expect(loadTokenEntries(path.join(tempDir, 'missing.json'))).toBeNull();
  });

  it('should return null when every entry is invalid', () => {
    const filePath = path.join(tempDir, 'invalid.json');
    fs.writeFileSync(filePath, JSON.stringify([{ name: 'no-token' }]));
    expect(loadTokenEntries(filePath)).toBeNull();
  });
});

describe('TokenListLoader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-list-loader-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return tokens in the order they appear in the JSON file', () => {
    const filePath = path.join(tempDir, 'tokens.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify([
        { name: 'first', token: 'token-1' },
        { name: 'second', token: 'token-2' },
      ]),
    );
    expect(loadTokens(filePath)).toEqual(['token-1', 'token-2']);
  });

  it('should return null when the file does not exist', () => {
    expect(loadTokens(path.join(tempDir, 'missing.json'))).toBeNull();
  });

  it('should return null when the JSON root is not an array', () => {
    const filePath = path.join(tempDir, 'object.json');
    fs.writeFileSync(filePath, JSON.stringify({ token: 'token-1' }));
    expect(loadTokens(filePath)).toBeNull();
  });

  it('should return null when JSON parsing fails', () => {
    const filePath = path.join(tempDir, 'malformed.json');
    fs.writeFileSync(filePath, '{not json');
    expect(loadTokens(filePath)).toBeNull();
  });

  it('should skip entries that do not contain a string token', () => {
    const filePath = path.join(tempDir, 'mixed.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify([
        { name: 'no-token' },
        { name: 'first', token: 'token-1' },
        { name: 'numeric', token: 123 },
        { name: 'second', token: 'token-2' },
      ]),
    );
    expect(loadTokens(filePath)).toEqual(['token-1', 'token-2']);
  });

  it('should return null when every entry is invalid', () => {
    const filePath = path.join(tempDir, 'no-valid-entries.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify([{ name: 'no-token' }, { token: 42 }]),
    );
    expect(loadTokens(filePath)).toBeNull();
  });

  it('should expand a leading tilde to the home directory', () => {
    const home = os.homedir();
    const fileName = `tdpm-loader-${process.pid}-${Date.now()}.json`;
    const targetPath = path.join(home, fileName);
    fs.writeFileSync(
      targetPath,
      JSON.stringify([{ name: 'first', token: 'home-token' }]),
    );
    try {
      expect(loadTokens(`~/${fileName}`)).toEqual(['home-token']);
    } finally {
      fs.unlinkSync(targetPath);
    }
  });
});
