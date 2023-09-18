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

export function resolveModuleGraph(
    filePaths: string | string[],
    extensions?: string[],
    conditions?: string[],
): Record<string, ResolvedRequests> {
    const resolveRequest = createRequestResolver({ fs: { ...fs, ...path }, extensions, conditions });
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

export function extractModuleRequests(sourceFile: ts.SourceFile): string[] {
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
        const isNonTypeImport = isImportDeclaration(node) && !isTypeOnlyImport(node);
        const isNonTypeExport = isExportDeclaration(node) && !isTypeOnlyExports(node);

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

function isTypeOnlyExports(node: ts.ExportDeclaration) {
    return node.isTypeOnly || hasOnlyTypeBindings(node.exportClause);
}

function isTypeOnlyImport(node: ts.ImportDeclaration) {
    return (
        node.importClause?.isTypeOnly ||
        (node.importClause?.name === undefined && hasOnlyTypeBindings(node.importClause?.namedBindings))
    );
}

function hasOnlyTypeBindings(bindings?: ts.NamedImportBindings | ts.NamedExportBindings) {
    return (
        (bindings?.kind === ts.SyntaxKind.NamedImports || bindings?.kind === ts.SyntaxKind.NamedExports) &&
        bindings.elements.length > 0 &&
        bindings.elements.every(isTypeOnlySpecifier)
    );
}

function isTypeOnlySpecifier(specifier: ts.ImportSpecifier | ts.ExportSpecifier): boolean {
    return specifier.isTypeOnly;
}

function isRequireIdentifier(expression: ts.Expression): expression is ts.Identifier {
    return isIdentifier(expression) && expression.text === 'require';
}

function isDynamicImportKeyword({ kind }: ts.Expression) {
    return kind === ImportKeyword;
}
