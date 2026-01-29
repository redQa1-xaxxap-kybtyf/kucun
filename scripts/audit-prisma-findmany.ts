import { execSync } from 'node:child_process';
import path from 'node:path';

import ts from 'typescript';

type FindingSeverity = 'error' | 'warn';

type Finding = {
  severity: FindingSeverity;
  file: string;
  line: number;
  column: number;
  model?: string;
  message: string;
};

type Summary = {
  scannedFiles: number;
  findManyCalls: number;
  withoutArgs: number;
  withoutSelectOrInclude: number;
  withoutTake: number;
  includeBooleanTrue: number;
  userFindManyWithoutSelect: number;
  errors: number;
  warnings: number;
};

function getRepoRoot(): string {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
}

function getTrackedTsFiles(): string[] {
  const output = execSync('git ls-files', { encoding: 'utf8' });
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
    .filter(file => !file.startsWith('node_modules/'));
}

function getLineColumn(sourceFile: ts.SourceFile, node: ts.Node) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile)
  );
  return { line: line + 1, column: character + 1 };
}

function getPropertyInitializer(
  object: ts.ObjectLiteralExpression,
  name: string
): ts.Expression | undefined {
  for (const prop of object.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const propName = prop.name;
      if (
        (ts.isIdentifier(propName) && propName.text === name) ||
        (ts.isStringLiteral(propName) && propName.text === name)
      ) {
        return prop.initializer;
      }
      continue;
    }

    // Handle shorthand `{ select, take }` patterns to avoid false positives.
    if (ts.isShorthandPropertyAssignment(prop)) {
      const propName = prop.name;
      if (ts.isIdentifier(propName) && propName.text === name) {
        return prop.objectAssignmentInitializer ?? propName;
      }
    }
  }
  return undefined;
}

function getModelNameFromReceiver(receiver: ts.Expression): string | undefined {
  if (
    ts.isPropertyAccessExpression(receiver) ||
    ts.isPropertyAccessChain(receiver)
  ) {
    return receiver.name.text;
  }
  return undefined;
}

function isBooleanTrueLiteral(node: ts.Expression): boolean {
  return node.kind === ts.SyntaxKind.TrueKeyword;
}

function collectBooleanTrueKeys(object: ts.ObjectLiteralExpression): string[] {
  const keys: string[] = [];
  for (const prop of object.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      continue;
    }
    if (!isBooleanTrueLiteral(prop.initializer)) {
      continue;
    }
    const propName = prop.name;
    if (ts.isIdentifier(propName)) {
      keys.push(propName.text);
    } else if (ts.isStringLiteral(propName)) {
      keys.push(propName.text);
    }
  }
  return keys;
}

function analyzeSourceFile(sourceFile: ts.SourceFile): Finding[] {
  const findings: Finding[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const isPropertyAccess =
        ts.isPropertyAccessExpression(expr) || ts.isPropertyAccessChain(expr);
      if (isPropertyAccess && expr.name.text === 'findMany') {
        const model = getModelNameFromReceiver(expr.expression);
        const location = getLineColumn(sourceFile, expr.name);

        if (node.arguments.length === 0) {
          findings.push({
            severity: model === 'user' ? 'error' : 'warn',
            file: sourceFile.fileName,
            ...location,
            model,
            message:
              'findMany() called without args (unbounded + full row fetch)',
          });
          ts.forEachChild(node, visit);
          return;
        }

        const firstArg = node.arguments[0];
        if (!ts.isObjectLiteralExpression(firstArg)) {
          findings.push({
            severity: model === 'user' ? 'error' : 'warn',
            file: sourceFile.fileName,
            ...location,
            model,
            message:
              'findMany() called with non-object args (unable to audit select/take)',
          });
          ts.forEachChild(node, visit);
          return;
        }

        const selectInit = getPropertyInitializer(firstArg, 'select');
        const includeInit = getPropertyInitializer(firstArg, 'include');
        const takeInit = getPropertyInitializer(firstArg, 'take');

        if (!selectInit && !includeInit) {
          findings.push({
            severity: model === 'user' ? 'error' : 'warn',
            file: sourceFile.fileName,
            ...location,
            model,
            message:
              'findMany() without select/include (fetches all scalar fields)',
          });
        }

        if (!takeInit) {
          findings.push({
            severity: 'warn',
            file: sourceFile.fileName,
            ...location,
            model,
            message: 'findMany() without take (unbounded result size)',
          });
        }

        if (model === 'user' && !selectInit) {
          findings.push({
            severity: 'error',
            file: sourceFile.fileName,
            ...location,
            model,
            message:
              'User.findMany() without select may fetch passwordHash (use select)',
          });
        }

        if (includeInit && ts.isObjectLiteralExpression(includeInit)) {
          const boolTrueKeys = collectBooleanTrueKeys(includeInit);
          if (boolTrueKeys.length > 0) {
            const includesUser = boolTrueKeys.includes('user');
            findings.push({
              severity: includesUser ? 'error' : 'warn',
              file: sourceFile.fileName,
              ...location,
              model,
              message: `include contains boolean true keys: ${boolTrueKeys.join(', ')}`,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function buildSummary(findings: Finding[], scannedFiles: number): Summary {
  const summary: Summary = {
    scannedFiles,
    findManyCalls: 0,
    withoutArgs: 0,
    withoutSelectOrInclude: 0,
    withoutTake: 0,
    includeBooleanTrue: 0,
    userFindManyWithoutSelect: 0,
    errors: 0,
    warnings: 0,
  };

  for (const finding of findings) {
    if (finding.severity === 'error') {
      summary.errors += 1;
    } else {
      summary.warnings += 1;
    }

    // Heuristics based on message text.
    if (finding.message.startsWith('findMany')) {
      summary.findManyCalls += 1;
    }
    if (finding.message.includes('without args')) {
      summary.withoutArgs += 1;
    }
    if (finding.message.includes('without select/include')) {
      summary.withoutSelectOrInclude += 1;
    }
    if (finding.message.includes('without take')) {
      summary.withoutTake += 1;
    }
    if (finding.message.includes('include contains boolean true')) {
      summary.includeBooleanTrue += 1;
    }
    if (finding.message.includes('User.findMany() without select')) {
      summary.userFindManyWithoutSelect += 1;
    }
  }

  return summary;
}

function resolveMaxToPrint(total: number): number {
  const args = process.argv.slice(2);
  if (args.includes('--all')) {
    return total;
  }

  const maxArg = args.find(arg => arg.startsWith('--max='));
  if (maxArg) {
    const parsed = Number.parseInt(maxArg.slice('--max='.length), 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  const maxIndex = args.findIndex(arg => arg === '--max');
  if (maxIndex >= 0) {
    const parsed = Number.parseInt(args[maxIndex + 1] ?? '', 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 80;
}

function main() {
  const repoRoot = getRepoRoot();
  const files = getTrackedTsFiles();

  const findings: Finding[] = [];

  for (const relativePath of files) {
    const absolutePath = path.join(repoRoot, relativePath);
    const content = ts.sys.readFile(absolutePath);
    if (!content) {
      continue;
    }

    const sourceFile = ts.createSourceFile(
      relativePath,
      content,
      ts.ScriptTarget.ES2022,
      true,
      relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    findings.push(...analyzeSourceFile(sourceFile));
  }

  const summary = buildSummary(findings, files.length);

  // Print summary first.
  // eslint-disable-next-line no-console
  console.log('[audit] Prisma findMany audit');
  // eslint-disable-next-line no-console
  console.log(`- scanned files: ${summary.scannedFiles}`);
  // eslint-disable-next-line no-console
  console.log(
    `- findings: ${findings.length} (${summary.errors} errors, ${summary.warnings} warnings)`
  );

  // Print top findings (errors first).
  const sorted = [...findings].sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'error' ? -1 : 1;
    }
    if (a.file !== b.file) {
      return a.file.localeCompare(b.file);
    }
    return a.line - b.line;
  });

  const maxToPrint = resolveMaxToPrint(sorted.length);
  for (const finding of sorted.slice(0, maxToPrint)) {
    const modelSuffix = finding.model ? ` (${finding.model})` : '';
    // eslint-disable-next-line no-console
    console.log(
      `- [${finding.severity}] ${finding.file}:${finding.line}:${finding.column}${modelSuffix} ${finding.message}`
    );
  }

  if (sorted.length > maxToPrint) {
    // eslint-disable-next-line no-console
    console.log(`- ... ${sorted.length - maxToPrint} more`);
  }

  // Exit non-zero on errors so CI can optionally use it.
  if (summary.errors > 0) {
    process.exitCode = 1;
  }
}

main();
