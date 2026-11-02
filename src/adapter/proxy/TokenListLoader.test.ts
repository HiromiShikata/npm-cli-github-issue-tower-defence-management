import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadTokenEntries, loadTokens } from './TokenListLoader';

const errorMessageOf = (action: () => unknown): string => {
  try {
    action();
  } catch (error) {
    if (error instanceof Error) return error.message;
  }
  throw new Error('expected the action to throw an Error');
};

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

  it('should throw the read error when the token list path is a directory', () => {
    const directoryPath = path.join(tempDir, 'tokens');
    fs.mkdirSync(directoryPath);

    const errorMessage = errorMessageOf(() => loadTokenEntries(directoryPath));

    expect(errorMessage).toContain(directoryPath);
    expect(errorMessage).toMatch(/EISDIR/);
  });

  it('should throw the parse error with the path but without a token value', () => {
    const filePath = path.join(tempDir, 'malformed.json');
    const secret = 'sk-ant-oat01-SECRETSECRET';
    fs.writeFileSync(filePath, `{"token":"${secret}",`);

    const errorMessage = errorMessageOf(() => loadTokenEntries(filePath));

    expect(errorMessage).toContain(filePath);
    expect(errorMessage).toContain('SyntaxError');
    expect(errorMessage).not.toContain(secret);
  });

  it('should not leak token text from a JSON syntax error snippet when a trailing comma follows a token entry', () => {
    const filePath = path.join(tempDir, 'trailing-comma.json');
    fs.writeFileSync(filePath, '[{"token":"sk-ant-oat01-SECRETSECRET"},]');

    const errorMessage = errorMessageOf(() => loadTokenEntries(filePath));
    const messageWithoutFilePath = errorMessage.split(filePath).join('');

    expect(errorMessage).toContain(filePath);
    expect(errorMessage).toContain('JSON');
    expect(messageWithoutFilePath).not.toContain('SECRET');
    expect(messageWithoutFilePath).not.toContain('sk-ant');
  });

  it('should not leak token text when the file content is a bare token string rather than JSON', () => {
    const filePath = path.join(tempDir, 'bare-token.txt');
    fs.writeFileSync(filePath, 'sk-ant-oat01-SECRETSECRET');

    const errorMessage = errorMessageOf(() => loadTokenEntries(filePath));
    const messageWithoutFilePath = errorMessage.split(filePath).join('');

    expect(errorMessage).toContain(filePath);
    expect(errorMessage).toContain('JSON');
    expect(messageWithoutFilePath).not.toContain('SECRET');
    expect(messageWithoutFilePath).not.toContain('sk-ant');
  });

  it('should throw when the token list JSON root is not an array', () => {
    const filePath = path.join(tempDir, 'object.json');
    const secret = 'sk-ant-oat01-SECRETSECRET';
    fs.writeFileSync(filePath, JSON.stringify({ token: secret }));

    const errorMessage = errorMessageOf(() => loadTokenEntries(filePath));

    expect(errorMessage).toContain(filePath);
    expect(errorMessage).toContain('array');
    expect(errorMessage).not.toContain(secret);
  });

  it('should include selectionWeight when the entry has a finite number', () => {
    const filePath = path.join(tempDir, 'tokens.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify([
        { name: 'alice', token: 'token-a', selectionWeight: 0.8 },
        { name: 'bob', token: 'token-b', selectionWeight: 2 },
      ]),
    );
    expect(loadTokenEntries(filePath)).toEqual([
      { name: 'alice', token: 'token-a', selectionWeight: 0.8 },
      { name: 'bob', token: 'token-b', selectionWeight: 2 },
    ]);
  });

  it('should omit selectionWeight when it is absent', () => {
    const filePath = path.join(tempDir, 'tokens.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify([{ name: 'alice', token: 'token-a' }]),
    );
    expect(loadTokenEntries(filePath)).toEqual([
      { name: 'alice', token: 'token-a' },
    ]);
  });

  it('should ignore a non-numeric selectionWeight', () => {
    const filePath = path.join(tempDir, 'tokens.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify([
        { name: 'alice', token: 'token-a', selectionWeight: 'high' },
        { name: 'bob', token: 'token-b', selectionWeight: null },
      ]),
    );
    expect(loadTokenEntries(filePath)).toEqual([
      { name: 'alice', token: 'token-a' },
      { name: 'bob', token: 'token-b' },
    ]);
  });

  it('should carry selectionWeight on a positionally named entry', () => {
    const filePath = path.join(tempDir, 'tokens.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify([{ token: 'token-a', selectionWeight: 0.5 }]),
    );
    expect(loadTokenEntries(filePath)).toEqual([
      { name: 'token-1', token: 'token-a', selectionWeight: 0.5 },
    ]);
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

  it('should throw when the JSON root is not an array', () => {
    const filePath = path.join(tempDir, 'object.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({ token: 'sk-ant-oat01-SECRETSECRET' }),
    );
    const errorMessage = errorMessageOf(() => loadTokens(filePath));

    expect(errorMessage).toContain(filePath);
    expect(errorMessage).toContain('array');
    expect(errorMessage).not.toContain('sk-ant-oat01-SECRETSECRET');
  });

  it('should throw when JSON parsing fails', () => {
    const filePath = path.join(tempDir, 'malformed.json');
    fs.writeFileSync(filePath, '{"token":"sk-ant-oat01-SECRETSECRET",');
    const errorMessage = errorMessageOf(() => loadTokens(filePath));

    expect(errorMessage).toContain(filePath);
    expect(errorMessage).toContain('SyntaxError');
    expect(errorMessage).not.toContain('sk-ant-oat01-SECRETSECRET');
  });

  it('should throw when the token list path is a directory', () => {
    const directoryPath = path.join(tempDir, 'tokens');
    fs.mkdirSync(directoryPath);

    const errorMessage = errorMessageOf(() => loadTokens(directoryPath));

    expect(errorMessage).toContain(directoryPath);
    expect(errorMessage).toMatch(/EISDIR/);
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
