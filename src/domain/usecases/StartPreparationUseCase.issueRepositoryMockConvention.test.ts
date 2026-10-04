import { readFileSync } from 'fs';
import { join } from 'path';
import * as ts from '@typescript/typescript6';

const START_PREPARATION_USE_CASE_TEST_FILE_PATH = join(
  __dirname,
  'StartPreparationUseCase.test.ts',
);

type AbstractSyntaxTreeNode = Parameters<typeof ts.isTypeReferenceNode>[0];

const parseStartPreparationUseCaseTestSourceFile =
  (): AbstractSyntaxTreeNode => {
    const sourceText = readFileSync(
      START_PREPARATION_USE_CASE_TEST_FILE_PATH,
      'utf8',
    );
    return ts.createSourceFile(
      START_PREPARATION_USE_CASE_TEST_FILE_PATH,
      sourceText,
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );
  };

const collectAllDescendantNodes = (
  root: AbstractSyntaxTreeNode,
): AbstractSyntaxTreeNode[] => {
  const nodes: AbstractSyntaxTreeNode[] = [];
  const visit = (node: AbstractSyntaxTreeNode): void => {
    nodes.push(node);
    node.forEachChild(visit);
  };
  visit(root);
  return nodes;
};

const isHandDuplicatedPickIssueRepositoryTypeReference = (
  node: AbstractSyntaxTreeNode,
): boolean => {
  if (!ts.isTypeReferenceNode(node)) return false;
  if (!ts.isIdentifier(node.typeName) || node.typeName.text !== 'Pick')
    return false;
  const firstTypeArgument = node.typeArguments?.[0];
  if (
    firstTypeArgument === undefined ||
    !ts.isTypeReferenceNode(firstTypeArgument)
  )
    return false;
  return (
    ts.isIdentifier(firstTypeArgument.typeName) &&
    firstTypeArgument.typeName.text === 'IssueRepository'
  );
};

const isMockIssueRepositoryCallExpression = (
  node: AbstractSyntaxTreeNode,
): boolean => {
  if (!ts.isCallExpression(node)) return false;
  if (!ts.isIdentifier(node.expression) || node.expression.text !== 'mock')
    return false;
  const typeArguments = node.typeArguments;
  if (typeArguments === undefined || typeArguments.length !== 1) return false;
  const soleTypeArgument = typeArguments[0];
  return (
    ts.isTypeReferenceNode(soleTypeArgument) &&
    ts.isIdentifier(soleTypeArgument.typeName) &&
    soleTypeArgument.typeName.text === 'IssueRepository'
  );
};

const isMockProxyIssueRepositoryTypeReference = (
  node: AbstractSyntaxTreeNode,
): boolean => {
  if (!ts.isTypeReferenceNode(node)) return false;
  if (!ts.isIdentifier(node.typeName) || node.typeName.text !== 'MockProxy')
    return false;
  const firstTypeArgument = node.typeArguments?.[0];
  if (
    firstTypeArgument === undefined ||
    !ts.isTypeReferenceNode(firstTypeArgument)
  )
    return false;
  return (
    ts.isIdentifier(firstTypeArgument.typeName) &&
    firstTypeArgument.typeName.text === 'IssueRepository'
  );
};

describe('StartPreparationUseCase.test.ts IssueRepository test double convention', () => {
  it('never hand-duplicates the IssueRepository test double as a Pick<IssueRepository, ...> type literal, and uses the jest-mock-extended mock<IssueRepository>()/MockProxy<IssueRepository> pattern at least twice', () => {
    const sourceFile = parseStartPreparationUseCaseTestSourceFile();
    const allNodes = collectAllDescendantNodes(sourceFile);

    const handDuplicatedPickIssueRepositoryTypeReferenceCount = allNodes.filter(
      isHandDuplicatedPickIssueRepositoryTypeReference,
    ).length;
    expect(handDuplicatedPickIssueRepositoryTypeReferenceCount).toBe(0);

    const mockIssueRepositoryCallExpressionCount = allNodes.filter(
      isMockIssueRepositoryCallExpression,
    ).length;
    const mockProxyIssueRepositoryTypeReferenceCount = allNodes.filter(
      isMockProxyIssueRepositoryTypeReference,
    ).length;
    const usesEstablishedJestMockExtendedPattern =
      mockIssueRepositoryCallExpressionCount >= 2 ||
      mockProxyIssueRepositoryTypeReferenceCount >= 2;
    expect(usesEstablishedJestMockExtendedPattern).toBe(true);
  });
});
