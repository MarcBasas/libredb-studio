/**
 * Finds the places a source file branches on a database type id, by walking its syntax tree, for the guard in
 * `tests/unit/lib/no-engine-branches.test.ts` (engine contract spec 6.1).
 *
 * A branch is one of five shapes:
 *
 * - `keyed-table`: a `Record`, `Set`, `Map` or their read-only forms keyed by an engine type, or a mapped type over
 *   one, where an engine type is `DatabaseType`, `DatabaseConnection["type"]`, a union or `Exclude`/`Extract` of
 *   those or of type-id literals, or a type alias of any of these declared in the same file;
 * - `type-id-array`: an array literal holding a type-id string, one finding per array;
 * - `comparison`: `===`, `!==`, `==` or `!=` with a type-id string on either side;
 * - `case-label`: a `case` whose label is a type-id string;
 * - `default-position`: a type-id string as the fallback of `||`, `??`, `||=` or `??=`, as a branch of a
 *   conditional, or as the default of a parameter or a destructured binding.
 *
 * A type-id string is a string literal, or a template literal with no substitution, whose whole text is a member of
 * the given set, seen through parentheses and `as`, `satisfies` and `!`.
 * Comments, plain arguments, object keys, JSX attributes and longer words are therefore never a finding.
 */
import ts from "typescript";

export type BranchShape = "keyed-table" | "type-id-array" | "comparison" | "case-label" | "default-position";

export interface BranchFinding {
  readonly path: string;
  readonly declaration: string;
  readonly shape: BranchShape;
  readonly line: number;
  readonly text: string;
}

const KEYED_COLLECTIONS = new Set(["Record", "Set", "ReadonlySet", "Map", "ReadonlyMap", "WeakMap"]);
const NARROWING_HELPERS = new Set(["Exclude", "Extract", "NonNullable"]);
const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);
const FALLBACK = new Set([
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

/** The rightmost name of a type reference, so `types.DatabaseType` reads as `DatabaseType`. */
function referenceName(name: ts.EntityName): string {
  return ts.isIdentifier(name) ? name.text : name.right.text;
}

function stringText(node: ts.Node): string | undefined {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;
}

export function findEngineBranches(path: string, source: string, typeIds: ReadonlySet<string>): BranchFinding[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: BranchFinding[] = [];

  const isTypeId = (node: ts.Expression): boolean => {
    let inner: ts.Expression = node;
    while (
      ts.isParenthesizedExpression(inner) ||
      ts.isAsExpression(inner) ||
      ts.isSatisfiesExpression(inner) ||
      ts.isTypeAssertionExpression(inner) ||
      ts.isNonNullExpression(inner)
    ) {
      inner = inner.expression;
    }
    const text = stringText(inner);
    return text !== undefined && typeIds.has(text);
  };

  const aliasTargets = new Map<string, ts.TypeNode>();
  for (const statement of file.statements) {
    if (ts.isTypeAliasDeclaration(statement)) aliasTargets.set(statement.name.text, statement.type);
  }

  const isEngineType = (node: ts.TypeNode, seen: ReadonlySet<string> = new Set()): boolean => {
    if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)) return isEngineType(node.type, seen);
    if (ts.isLiteralTypeNode(node)) {
      const text = stringText(node.literal);
      return text !== undefined && typeIds.has(text);
    }
    if (ts.isUnionTypeNode(node)) return node.types.every((member) => isEngineType(member, seen));
    if (ts.isIndexedAccessTypeNode(node)) {
      return (
        ts.isTypeReferenceNode(node.objectType) &&
        referenceName(node.objectType.typeName) === "DatabaseConnection" &&
        ts.isLiteralTypeNode(node.indexType) &&
        stringText(node.indexType.literal) === "type"
      );
    }
    if (!ts.isTypeReferenceNode(node)) return false;
    const name = referenceName(node.typeName);
    if (name === "DatabaseType") return true;
    const first = node.typeArguments?.[0];
    if (NARROWING_HELPERS.has(name)) return first !== undefined && isEngineType(first, seen);
    const target = aliasTargets.get(name);
    if (target === undefined || seen.has(name)) return false;
    return isEngineType(target, new Set([...seen, name]));
  };

  const declarationOf = (node: ts.Node): string => {
    for (let current = node.parent; current !== undefined; current = current.parent) {
      if (
        (ts.isVariableDeclaration(current) ||
          ts.isFunctionDeclaration(current) ||
          ts.isFunctionExpression(current) ||
          ts.isMethodDeclaration(current) ||
          ts.isGetAccessorDeclaration(current) ||
          ts.isSetAccessorDeclaration(current) ||
          ts.isClassDeclaration(current) ||
          ts.isClassExpression(current) ||
          ts.isPropertyDeclaration(current) ||
          ts.isTypeAliasDeclaration(current) ||
          ts.isInterfaceDeclaration(current)) &&
        current.name !== undefined &&
        (ts.isIdentifier(current.name) || ts.isPrivateIdentifier(current.name) || ts.isStringLiteral(current.name))
      ) {
        return current.name.text;
      }
    }
    return "<module>";
  };

  const report = (node: ts.Node, shape: BranchShape): void => {
    findings.push({
      path,
      declaration: declarationOf(node),
      shape,
      line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
      text: node.getText(file).replace(/\s+/g, " "),
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isTypeReferenceNode(node) && KEYED_COLLECTIONS.has(referenceName(node.typeName))) {
      const key = node.typeArguments?.[0];
      if (key !== undefined && isEngineType(key)) report(node, "keyed-table");
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      const key = node.typeArguments?.[0];
      if (KEYED_COLLECTIONS.has(node.expression.text) && key !== undefined && isEngineType(key)) {
        report(node, "keyed-table");
      }
    } else if (ts.isMappedTypeNode(node)) {
      const constraint = node.typeParameter.constraint;
      if (constraint !== undefined && isEngineType(constraint)) report(node, "keyed-table");
    } else if (ts.isArrayLiteralExpression(node)) {
      if (node.elements.some(isTypeId)) report(node, "type-id-array");
    } else if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      if (EQUALITY.has(operator) && (isTypeId(node.left) || isTypeId(node.right))) report(node, "comparison");
      else if (FALLBACK.has(operator) && isTypeId(node.right)) report(node, "default-position");
    } else if (ts.isCaseClause(node)) {
      if (isTypeId(node.expression)) report(node.expression, "case-label");
    } else if (ts.isConditionalExpression(node)) {
      if (isTypeId(node.whenTrue) || isTypeId(node.whenFalse)) report(node, "default-position");
    } else if (ts.isParameter(node) || ts.isBindingElement(node)) {
      if (node.initializer !== undefined && isTypeId(node.initializer)) report(node, "default-position");
    }
    ts.forEachChild(node, visit);
  };

  visit(file);
  return findings;
}
