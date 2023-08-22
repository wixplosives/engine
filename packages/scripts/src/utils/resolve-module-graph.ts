import { createDependencyResolver, createRequestResolver, type ResolvedRequests } from '@file-services/resolve';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { isCodeModule } from '../build-constants.js';

const {
    SyntaxKind: { ImportKeyword },
    forEachChild,
    isCallExpression,
    isExportDeclaration,
    isIdentifier,
    isImportDeclaration,
    isStringLiteral,
} = ts;

export function resolveModuleGraph(filePaths: string | string[]): Record<string, ResolvedRequests> {
    const resolveRequest = createRequestResolver({ fs: { ...fs, ...path } });
    const dependencyResolver = createDependencyResolver({
        extractRequests(filePath) {
            if (!isCodeModule(path.basename(filePath))) {
                return [];
            }
            const fileContents = fs.readFileSync(filePath, 'utf8');
            const sourceFile = ts.createSourceFile(filePath, fileContents, ts.ScriptTarget.ESNext);
            return extractModuleRequests(sourceFile);
        },
        resolveRequest(filePath, request) {
            const contextPath = path.dirname(filePath);
            const { resolvedFile } = resolveRequest(contextPath, request);
            if (resolvedFile === undefined) {
                throw new Error(`Could not resolve "${request}" from ${filePath}`);
            }
            return resolvedFile;
        },
    });
    return dependencyResolver(filePaths, true);
}

function extractModuleRequests(sourceFile: ts.SourceFile): string[] {
    const specifiers: string[] = [];

    const dynamicImportsFinder = (node: ts.Node): void => {
        if (isCallExpression(node)) {
            if (
                (isDynamicImportKeyword(node.expression) || isRequireIdentifier(node.expression)) &&
                node.arguments.length === 1 &&
                isStringLiteral(node.arguments[0]!)
            ) {
                const [{ text }] = node.arguments;
                specifiers.push(text);
                return;
            }
        }
        forEachChild(node, dynamicImportsFinder);
    };

    const importsFinder = (node: ts.Node) => {
        const isNonTypeImport = isImportDeclaration(node) && !node.importClause?.isTypeOnly;
        const isNonTypeExport = isExportDeclaration(node) && !node.isTypeOnly;

        if ((isNonTypeImport || isNonTypeExport) && node.moduleSpecifier && isStringLiteral(node.moduleSpecifier)) {
            const originalTarget = node.moduleSpecifier.text;
            specifiers.push(originalTarget);
            return;
        }

        // if not a static import/re-export, might be a dynamic import
        // so run that recursive visitor on `node`
        forEachChild(node, dynamicImportsFinder);
    };

    forEachChild(sourceFile, importsFinder);
    return specifiers;
}

function isRequireIdentifier(expression: ts.Expression): expression is ts.Identifier {
    return isIdentifier(expression) && expression.text === 'require';
}

function isDynamicImportKeyword({ kind }: ts.Expression) {
    return kind === ImportKeyword;
}
