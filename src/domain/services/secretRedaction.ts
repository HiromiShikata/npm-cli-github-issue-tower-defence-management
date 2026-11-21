export const REDACTED_SECRET_PLACEHOLDER = '[REDACTED]';

const PEM_PRIVATE_KEY_BEGIN_PATTERN =
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/g;

const PEM_PRIVATE_KEY_END_PATTERN = /-----END(?: [A-Z]+)? PRIVATE KEY-----/g;

const FIXED_PREFIX_TOKEN_PATTERN =
  /(?:ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|sk-ant-)[A-Za-z0-9_-]{20,}/g;

const CREDENTIAL_KEY_NAME_PATTERN = /token|secret|password|apikey|privatekey/i;

const JSON_STYLE_KEY_VALUE_PATTERN = /"([^"\n]*)"(\s*:\s*)"([^"\n]*)"/g;

const YAML_STYLE_KEY_VALUE_LINE_PATTERN =
  /^(\s*)([A-Za-z0-9_.-]+):(\s*)(.*)$/gm;

const findPatternFrom = (
  pattern: RegExp,
  text: string,
  startIndex: number,
): RegExpExecArray | null => {
  pattern.lastIndex = startIndex;
  return pattern.exec(text);
};

const redactPemPrivateKeyBlocks = (text: string): string => {
  const outputParts: string[] = [];
  let cursor = 0;
  let beginMatch = findPatternFrom(PEM_PRIVATE_KEY_BEGIN_PATTERN, text, cursor);
  while (beginMatch !== null) {
    const beginEnd = beginMatch.index + beginMatch[0].length;
    const endMatch = findPatternFrom(
      PEM_PRIVATE_KEY_END_PATTERN,
      text,
      beginEnd,
    );
    if (endMatch === null) {
      break;
    }
    outputParts.push(
      text.slice(cursor, beginMatch.index),
      REDACTED_SECRET_PLACEHOLDER,
    );
    cursor = endMatch.index + endMatch[0].length;
    beginMatch = findPatternFrom(PEM_PRIVATE_KEY_BEGIN_PATTERN, text, cursor);
  }
  outputParts.push(text.slice(cursor));
  return outputParts.join('');
};

const redactFixedPrefixTokens = (text: string): string =>
  text.replace(FIXED_PREFIX_TOKEN_PATTERN, REDACTED_SECRET_PLACEHOLDER);

const redactJsonStyleKeyValues = (text: string): string =>
  text.replace(
    JSON_STYLE_KEY_VALUE_PATTERN,
    (match: string, key: string, separator: string): string =>
      CREDENTIAL_KEY_NAME_PATTERN.test(key)
        ? `"${key}"${separator}"${REDACTED_SECRET_PLACEHOLDER}"`
        : match,
  );

const redactYamlStyleKeyValues = (text: string): string =>
  text.replace(
    YAML_STYLE_KEY_VALUE_LINE_PATTERN,
    (
      line: string,
      leadingWhitespace: string,
      key: string,
      separatorWhitespace: string,
    ): string => {
      if (!CREDENTIAL_KEY_NAME_PATTERN.test(key)) {
        return line;
      }
      return `${leadingWhitespace}${key}:${separatorWhitespace}${REDACTED_SECRET_PLACEHOLDER}`;
    },
  );

export const redactSecrets = (text: string): string => {
  const withoutPemBlocks = redactPemPrivateKeyBlocks(text);
  const withoutFixedPrefixTokens = redactFixedPrefixTokens(withoutPemBlocks);
  const withoutJsonStyleSecrets = redactJsonStyleKeyValues(
    withoutFixedPrefixTokens,
  );
  return redactYamlStyleKeyValues(withoutJsonStyleSecrets);
};
