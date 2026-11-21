import { REDACTED_SECRET_PLACEHOLDER, redactSecrets } from './secretRedaction';

describe('redactSecrets', () => {
  it('redacts every known secret shape while leaving all other text unchanged', () => {
    const cases: { description: string; input: string; expected: string }[] = [
      {
        description:
          'plain text with no secret-shaped substring is returned byte-for-byte unchanged',
        input: 'Fetching project data for example-org/example-repo',
        expected: 'Fetching project data for example-org/example-repo',
      },
      {
        description:
          'a ghp_ prefixed GitHub token is replaced, surrounding text unchanged',
        input:
          'Authenticated using ghp_' +
          'AbCdEfGhIjKlMnOpQrStUvWxYz123456 for this request',
        expected: `Authenticated using ${REDACTED_SECRET_PLACEHOLDER} for this request`,
      },
      {
        description:
          'a gho_ prefixed GitHub token is replaced, surrounding text unchanged',
        input:
          'Authenticated using gho_' +
          'OAuthTokenForTestingPurposes1234567890 for this request',
        expected: `Authenticated using ${REDACTED_SECRET_PLACEHOLDER} for this request`,
      },
      {
        description:
          'a ghu_ prefixed GitHub token is replaced, surrounding text unchanged',
        input:
          'Authenticated using ghu_' +
          'UserToServerTokenForTesting1234567890 for this request',
        expected: `Authenticated using ${REDACTED_SECRET_PLACEHOLDER} for this request`,
      },
      {
        description:
          'a ghs_ prefixed GitHub token is replaced, surrounding text unchanged',
        input:
          'Authenticated using ghs_' +
          'ServerToServerTokenForTesting1234567890 for this request',
        expected: `Authenticated using ${REDACTED_SECRET_PLACEHOLDER} for this request`,
      },
      {
        description:
          'a ghr_ prefixed GitHub token is replaced, surrounding text unchanged',
        input:
          'Authenticated using ghr_' +
          'RefreshTokenForTestingPurposes1234567890 for this request',
        expected: `Authenticated using ${REDACTED_SECRET_PLACEHOLDER} for this request`,
      },
      {
        description:
          'a github_pat_ prefixed GitHub token is replaced, surrounding text unchanged',
        input:
          'Authenticated using github_pat_' +
          '11AbCdEfGhIjKlMnOpQrSt1234567890abcdefghijklmnop for this request',
        expected: `Authenticated using ${REDACTED_SECRET_PLACEHOLDER} for this request`,
      },
      {
        description:
          'a sk-ant- prefixed Anthropic token is replaced, surrounding text unchanged',
        input:
          'Authenticated using sk-ant-' +
          'AbCdEfGhIjKlMnOpQrStUvWxYz123456 for this request',
        expected: `Authenticated using ${REDACTED_SECRET_PLACEHOLDER} for this request`,
      },
      {
        description:
          'a PEM private-key block is replaced as a single block, surrounding text unchanged',
        input: [
          'Loaded key:',
          '-----BEGIN' + ' PRIVATE KEY-----',
          'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj',
          '-----END' + ' PRIVATE KEY-----',
          'Done.',
        ].join('\n'),
        expected: ['Loaded key:', REDACTED_SECRET_PLACEHOLDER, 'Done.'].join(
          '\n',
        ),
      },
      {
        description:
          'a PEM RSA private-key block (qualifier word tolerated) is replaced as a single block',
        input: [
          'Loaded key:',
          '-----BEGIN' + ' RSA PRIVATE KEY-----',
          'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj',
          '-----END' + ' RSA PRIVATE KEY-----',
          'Done.',
        ].join('\n'),
        expected: ['Loaded key:', REDACTED_SECRET_PLACEHOLDER, 'Done.'].join(
          '\n',
        ),
      },
      {
        description:
          'a JSON-shaped "token"-named key has only its value redacted, key and quotes preserved',
        input: '"slackUserToken": "xoxp-' + '1234567890-abcdefghijklmnop"',
        expected: `"slackUserToken": "${REDACTED_SECRET_PLACEHOLDER}"`,
      },
      {
        description:
          'a YAML-shaped "token"-named key has only its value redacted, key preserved',
        input: 'slackUserToken: xoxp-' + '1234567890-abcdefghijklmnop',
        expected: `slackUserToken: ${REDACTED_SECRET_PLACEHOLDER}`,
      },
      {
        description:
          'a YAML-shaped credential-named key with a quoted value has the value redacted despite the unquoted key',
        input: 'password: "mySuperSecretPassword123"',
        expected: `password: ${REDACTED_SECRET_PLACEHOLDER}`,
      },
      {
        description:
          'a JSON-shaped "secret"-named key has only its value redacted',
        input: '"clientSecret": "s3cr3tValueHere1234567890"',
        expected: `"clientSecret": "${REDACTED_SECRET_PLACEHOLDER}"`,
      },
      {
        description:
          'a JSON-shaped "password"-named key has only its value redacted',
        input: '"dbPassword": "p4ssw0rdValueHere1234567890"',
        expected: `"dbPassword": "${REDACTED_SECRET_PLACEHOLDER}"`,
      },
      {
        description:
          'a JSON-shaped "apikey"-named key has only its value redacted',
        input: '"apiKeyForService": "AKIAFAKEKEYVALUEXXXX1234567890"',
        expected: `"apiKeyForService": "${REDACTED_SECRET_PLACEHOLDER}"`,
      },
      {
        description:
          'a JSON-shaped "privatekey"-named key has only its value redacted',
        input: '"privateKeyPem": "someOpaqueKeyValueText1234567890"',
        expected: `"privateKeyPem": "${REDACTED_SECRET_PLACEHOLDER}"`,
      },
      {
        description:
          'a key name that does not match the credential-name pattern is returned completely unchanged',
        input: '"projectName": "example-org/example-repo"',
        expected: '"projectName": "example-org/example-repo"',
      },
      {
        description:
          'a fixed-prefix token and a PEM block in the same string are both independently replaced',
        input: [
          'Found credential ghp_' +
            'BothShapesRealisticToken1234567890AB in the environment.',
          '-----BEGIN' + ' PRIVATE KEY-----',
          'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj',
          '-----END' + ' PRIVATE KEY-----',
        ].join('\n'),
        expected: [
          `Found credential ${REDACTED_SECRET_PLACEHOLDER} in the environment.`,
          REDACTED_SECRET_PLACEHOLDER,
        ].join('\n'),
      },
      {
        description: 'an empty string is returned unchanged',
        input: '',
        expected: '',
      },
    ];

    for (const { description, input, expected } of cases) {
      expect({ description, actual: redactSecrets(input) }).toEqual({
        description,
        actual: expected,
      });
    }
  });

  it('replaces PEM private-key blocks with and without type words, keeping surrounding text', () => {
    const begin = '-----BEGIN' + ' PRIVATE KEY-----';
    const end = '-----END' + ' PRIVATE KEY-----';
    const placeholder = REDACTED_SECRET_PLACEHOLDER;
    const cases: { description: string; input: string; expected: string }[] = [
      {
        description:
          'a PEM block with no type word is replaced with surrounding text kept',
        input: `before ${begin}body${end} after`,
        expected: `before ${placeholder} after`,
      },
      {
        description: 'a PEM RSA block is replaced with surrounding text kept',
        input:
          'before -----BEGIN' +
          ' RSA PRIVATE KEY-----' +
          'body-----END' +
          ' RSA PRIVATE KEY-----' +
          ' after',
        expected: `before ${placeholder} after`,
      },
      {
        description: 'a PEM EC block is replaced with surrounding text kept',
        input:
          'before -----BEGIN' +
          ' EC PRIVATE KEY-----' +
          'body-----END' +
          ' EC PRIVATE KEY-----' +
          ' after',
        expected: `before ${placeholder} after`,
      },
      {
        description:
          'a PEM OPENSSH block is replaced with surrounding text kept',
        input:
          'before -----BEGIN' +
          ' OPENSSH PRIVATE KEY-----' +
          'body-----END' +
          ' OPENSSH PRIVATE KEY-----' +
          ' after',
        expected: `before ${placeholder} after`,
      },
      {
        description:
          'a BEGIN RSA block closed by a mismatched END EC marker is replaced up to the first END',
        input:
          'before -----BEGIN' +
          ' RSA PRIVATE KEY-----' +
          'body-----END' +
          ' EC PRIVATE KEY-----' +
          ' after',
        expected: `before ${placeholder} after`,
      },
      {
        description:
          'two PEM blocks in one string are each replaced with the text between them kept',
        input: `first ${begin}a${end} middle ${begin}b${end} last`,
        expected: `first ${placeholder} middle ${placeholder} last`,
      },
      {
        description:
          'a complete block followed by an unterminated BEGIN keeps the unterminated BEGIN',
        input: `${begin}a${end} x ${begin}b`,
        expected: `${placeholder} x ${begin}b`,
      },
      {
        description:
          'a run of unterminated BEGIN markers before one complete block is one placeholder from the first BEGIN to the first END',
        input: `head ${begin}x ${begin}y ${begin}z${end} tail`,
        expected: `head ${placeholder} tail`,
      },
      {
        description:
          'a lone unterminated BEGIN with no END after it is left unredacted',
        input: `text ${begin}body without an end marker`,
        expected: `text ${begin}body without an end marker`,
      },
      {
        description:
          'an END that appears only before a BEGIN does not close it, so the BEGIN is left unredacted',
        input: `${end}body ${begin}tail`,
        expected: `${end}body ${begin}tail`,
      },
    ];

    for (const { description, input, expected } of cases) {
      expect({ description, actual: redactSecrets(input) }).toEqual({
        description,
        actual: expected,
      });
    }
  });

  it('keeps the JSON, YAML and fixed-prefix redaction unchanged when a PEM block is in the same string', () => {
    const begin = '-----BEGIN' + ' PRIVATE KEY-----';
    const end = '-----END' + ' PRIVATE KEY-----';
    const placeholder = REDACTED_SECRET_PLACEHOLDER;
    const cases: { description: string; input: string; expected: string }[] = [
      {
        description:
          'a JSON-shaped credential key is redacted alongside a PEM block',
        input:
          '"slackUserToken": "xoxp-' + '1234567890"\n' + begin + 'body' + end,
        expected: `"slackUserToken": "${placeholder}"\n${placeholder}`,
      },
      {
        description:
          'a YAML-shaped credential key is redacted alongside a PEM block',
        input: `password: hunter2\n${begin}body${end}`,
        expected: `password: ${placeholder}\n${placeholder}`,
      },
      {
        description:
          'a fixed-prefix token, a YAML credential key and a PEM block in one string are all redacted',
        input: `token: ghp_${'AbCdEfGhIjKlMnOpQrStUvWxYz123456'}\n${begin}body${end}\nnote: keep`,
        expected: `token: ${placeholder}\n${placeholder}\nnote: keep`,
      },
    ];

    for (const { description, input, expected } of cases) {
      expect({ description, actual: redactSecrets(input) }).toEqual({
        description,
        actual: expected,
      });
    }
  });

  it('matches the original PEM pattern output for every string of up to four fragments', () => {
    const ORIGINAL_PEM_PATTERN =
      /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/g;
    const fragments = [
      '-----BEGIN' + ' PRIVATE KEY-----',
      '-----BEGIN' + ' RSA PRIVATE KEY-----',
      '-----END' + ' PRIVATE KEY-----',
      '-----END' + ' EC PRIVATE KEY-----',
      'body',
      '\n',
      '-----BEGIN',
      '-----END',
    ];
    const inputs: string[] = [''];
    let frontier: string[] = [''];
    for (let depth = 1; depth <= 4; depth += 1) {
      frontier = frontier.flatMap((prefix) =>
        fragments.map((fragment) => prefix + fragment),
      );
      inputs.push(...frontier);
    }

    const mismatches = inputs.flatMap((input) => {
      const expected = input.replace(
        ORIGINAL_PEM_PATTERN,
        REDACTED_SECRET_PLACEHOLDER,
      );
      const actual = redactSecrets(input);
      return actual === expected ? [] : [{ input, expected, actual }];
    });

    expect({ count: mismatches.length, first: mismatches.slice(0, 5) }).toEqual(
      {
        count: 0,
        first: [],
      },
    );
  });

  it('returns 216 KB of repeated unterminated BEGIN markers unchanged within 250 ms', () => {
    const measure = (input: string): { output: string; elapsedMs: number } => {
      redactSecrets('-----BEGIN' + ' PRIVATE KEY-----');
      const start = performance.now();
      const output = redactSecrets(input);
      return { output, elapsedMs: performance.now() - start };
    };
    const input = ('-----BEGIN' + ' PRIVATE KEY-----').repeat(8000);
    const { output, elapsedMs } = measure(input);

    expect({ sizeKb: 216, unchanged: output === input }).toEqual({
      sizeKb: 216,
      unchanged: true,
    });
    expect({ sizeKb: 216, withinBudget: elapsedMs < 250 }).toEqual({
      sizeKb: 216,
      withinBudget: true,
    });
  });

  it('returns 1 MB of repeated unterminated BEGIN markers unchanged within 250 ms', () => {
    const measure = (input: string): { output: string; elapsedMs: number } => {
      redactSecrets('-----BEGIN' + ' PRIVATE KEY-----');
      const start = performance.now();
      const output = redactSecrets(input);
      return { output, elapsedMs: performance.now() - start };
    };
    const input = ('-----BEGIN' + ' PRIVATE KEY-----').repeat(40000);
    const { output, elapsedMs } = measure(input);

    expect({ sizeMb: 1, unchanged: output === input }).toEqual({
      sizeMb: 1,
      unchanged: true,
    });
    expect({ sizeMb: 1, withinBudget: elapsedMs < 250 }).toEqual({
      sizeMb: 1,
      withinBudget: true,
    });
  });
});
