export type GitHubActionsContextValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: GitHubActionsContextValue };

type ComparisonOperator = '==' | '!=';
type LogicalOperator = '&&' | '||';

type ExpressionToken =
  | { readonly kind: 'identifierPath'; readonly segments: readonly string[] }
  | { readonly kind: 'stringLiteral'; readonly value: string }
  | {
      readonly kind: 'comparisonOperator';
      readonly operator: ComparisonOperator;
    }
  | { readonly kind: 'logicalOperator'; readonly operator: LogicalOperator }
  | { readonly kind: 'openParenthesis' }
  | { readonly kind: 'closeParenthesis' };

type ExpressionNode =
  | { readonly kind: 'identifierPath'; readonly segments: readonly string[] }
  | { readonly kind: 'stringLiteral'; readonly value: string }
  | {
      readonly kind: 'comparison';
      readonly operator: ComparisonOperator;
      readonly left: ExpressionNode;
      readonly right: ExpressionNode;
    }
  | {
      readonly kind: 'logical';
      readonly operator: LogicalOperator;
      readonly left: ExpressionNode;
      readonly right: ExpressionNode;
    };

const isWhitespaceCharacter = (character: string): boolean =>
  character === ' ' ||
  character === '\t' ||
  character === '\n' ||
  character === '\r';

const isIdentifierStartCharacter = (character: string): boolean =>
  /[A-Za-z_]/.test(character);

const isIdentifierBodyCharacter = (character: string): boolean =>
  /[A-Za-z0-9_.]/.test(character);

const tokenizeGitHubActionsExpression = (
  expression: string,
): ExpressionToken[] => {
  const tokens: ExpressionToken[] = [];
  let position = 0;
  while (position < expression.length) {
    const character = expression[position];
    if (isWhitespaceCharacter(character)) {
      position += 1;
      continue;
    }
    if (character === '(') {
      tokens.push({ kind: 'openParenthesis' });
      position += 1;
      continue;
    }
    if (character === ')') {
      tokens.push({ kind: 'closeParenthesis' });
      position += 1;
      continue;
    }
    if (character === "'") {
      const closingQuoteIndex = expression.indexOf("'", position + 1);
      if (closingQuoteIndex === -1) {
        throw new Error(
          `unterminated string literal starting at position ${position} in GitHub Actions expression: ${expression}`,
        );
      }
      tokens.push({
        kind: 'stringLiteral',
        value: expression.slice(position + 1, closingQuoteIndex),
      });
      position = closingQuoteIndex + 1;
      continue;
    }
    if (character === '=' && expression[position + 1] === '=') {
      tokens.push({ kind: 'comparisonOperator', operator: '==' });
      position += 2;
      continue;
    }
    if (character === '!' && expression[position + 1] === '=') {
      tokens.push({ kind: 'comparisonOperator', operator: '!=' });
      position += 2;
      continue;
    }
    if (character === '&' && expression[position + 1] === '&') {
      tokens.push({ kind: 'logicalOperator', operator: '&&' });
      position += 2;
      continue;
    }
    if (character === '|' && expression[position + 1] === '|') {
      tokens.push({ kind: 'logicalOperator', operator: '||' });
      position += 2;
      continue;
    }
    if (isIdentifierStartCharacter(character)) {
      let end = position + 1;
      while (
        end < expression.length &&
        isIdentifierBodyCharacter(expression[end])
      ) {
        end += 1;
      }
      tokens.push({
        kind: 'identifierPath',
        segments: expression.slice(position, end).split('.'),
      });
      position = end;
      continue;
    }
    throw new Error(
      `unsupported operator or character '${character}' at position ${position} in GitHub Actions expression: ${expression}`,
    );
  }
  return tokens;
};

const parseGitHubActionsExpression = (expression: string): ExpressionNode => {
  const tokens = tokenizeGitHubActionsExpression(expression);
  let position = 0;

  function peekToken(): ExpressionToken | undefined {
    return tokens[position];
  }

  function consumeComparisonOperator(): ComparisonOperator | undefined {
    const token = peekToken();
    if (token !== undefined && token.kind === 'comparisonOperator') {
      position += 1;
      return token.operator;
    }
    return undefined;
  }

  function consumeLogicalOperator(expected: LogicalOperator): boolean {
    const token = peekToken();
    if (
      token !== undefined &&
      token.kind === 'logicalOperator' &&
      token.operator === expected
    ) {
      position += 1;
      return true;
    }
    return false;
  }

  function parsePrimaryExpression(): ExpressionNode {
    const token = peekToken();
    if (token === undefined) {
      throw new Error(
        `unexpected end of GitHub Actions expression: ${expression}`,
      );
    }
    if (token.kind === 'openParenthesis') {
      position += 1;
      const inner = parseLogicalOrExpression();
      const closingToken = peekToken();
      if (
        closingToken === undefined ||
        closingToken.kind !== 'closeParenthesis'
      ) {
        throw new Error(
          `unbalanced parentheses in GitHub Actions expression: ${expression}`,
        );
      }
      position += 1;
      return inner;
    }
    if (token.kind === 'stringLiteral') {
      position += 1;
      return { kind: 'stringLiteral', value: token.value };
    }
    if (token.kind === 'identifierPath') {
      position += 1;
      return { kind: 'identifierPath', segments: token.segments };
    }
    throw new Error(
      `expected an identifier path, string literal, or parenthesized expression in GitHub Actions expression: ${expression}`,
    );
  }

  function parseEqualityExpression(): ExpressionNode {
    let node = parsePrimaryExpression();
    let operator = consumeComparisonOperator();
    while (operator !== undefined) {
      const right = parsePrimaryExpression();
      node = { kind: 'comparison', operator, left: node, right };
      operator = consumeComparisonOperator();
    }
    return node;
  }

  function parseLogicalAndExpression(): ExpressionNode {
    let node = parseEqualityExpression();
    while (consumeLogicalOperator('&&')) {
      const right = parseEqualityExpression();
      node = { kind: 'logical', operator: '&&', left: node, right };
    }
    return node;
  }

  function parseLogicalOrExpression(): ExpressionNode {
    let node = parseLogicalAndExpression();
    while (consumeLogicalOperator('||')) {
      const right = parseLogicalAndExpression();
      node = { kind: 'logical', operator: '||', left: node, right };
    }
    return node;
  }

  const rootNode = parseLogicalOrExpression();
  if (position !== tokens.length) {
    throw new Error(
      `unbalanced parentheses or trailing content in GitHub Actions expression: ${expression}`,
    );
  }
  return rootNode;
};

const isGitHubActionsContextRecord = (
  value: GitHubActionsContextValue,
): value is Record<string, GitHubActionsContextValue> =>
  typeof value === 'object' && value !== null;

const isNullishContextValue = (
  value: GitHubActionsContextValue,
): value is null | undefined => value === null || value === undefined;

const resolveIdentifierPath = (
  segments: readonly string[],
  context: Record<string, GitHubActionsContextValue>,
): GitHubActionsContextValue => {
  let current: GitHubActionsContextValue = context;
  for (const segment of segments) {
    if (!isGitHubActionsContextRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
};

const toLowerCasedComparableText = (value: string | number | boolean): string =>
  String(value).toLowerCase();

const evaluateEqualityComparison = (
  left: GitHubActionsContextValue,
  right: GitHubActionsContextValue,
): boolean => {
  if (isNullishContextValue(left) || isNullishContextValue(right)) {
    return isNullishContextValue(left) && isNullishContextValue(right);
  }
  if (
    isGitHubActionsContextRecord(left) ||
    isGitHubActionsContextRecord(right)
  ) {
    throw new Error(
      'cannot compare an object value with == or != in a GitHub Actions expression',
    );
  }
  return toLowerCasedComparableText(left) === toLowerCasedComparableText(right);
};

const toBooleanExpressionResult = (
  value: GitHubActionsContextValue,
): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (isNullishContextValue(value)) {
    return false;
  }
  if (isGitHubActionsContextRecord(value)) {
    return true;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return value.length > 0;
};

const evaluateExpressionNode = (
  node: ExpressionNode,
  context: Record<string, GitHubActionsContextValue>,
): GitHubActionsContextValue => {
  if (node.kind === 'stringLiteral') {
    return node.value;
  }
  if (node.kind === 'identifierPath') {
    return resolveIdentifierPath(node.segments, context);
  }
  if (node.kind === 'comparison') {
    const isEqual = evaluateEqualityComparison(
      evaluateExpressionNode(node.left, context),
      evaluateExpressionNode(node.right, context),
    );
    return node.operator === '==' ? isEqual : !isEqual;
  }
  const leftBoolean = toBooleanExpressionResult(
    evaluateExpressionNode(node.left, context),
  );
  if (node.operator === '&&') {
    return (
      leftBoolean &&
      toBooleanExpressionResult(evaluateExpressionNode(node.right, context))
    );
  }
  return (
    leftBoolean ||
    toBooleanExpressionResult(evaluateExpressionNode(node.right, context))
  );
};

export const evaluateGitHubActionsExpression = (
  expression: string,
  context: Record<string, GitHubActionsContextValue>,
): boolean => {
  const rootNode = parseGitHubActionsExpression(expression);
  return toBooleanExpressionResult(evaluateExpressionNode(rootNode, context));
};
