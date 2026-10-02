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
});
