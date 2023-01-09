import console from 'console';
import ts from 'typescript';
import prettier from '../component-studio/node_modules/prettier';
const f = ts.factory;
const files = ts.sys.readDirectory(ts.sys.resolvePath('.'), undefined, undefined, ['**/*.ts']);
for (const file of files) {
    // transform file
    const content = ts.sys.readFile(file);
    if (content && content.includes('new Feature(')) {
        console.log('transforming', file);
        const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
        const result = ts.transform(sourceFile, [featureTransformer]);
        const printer = ts.createPrinter({});
        const transformed = printer.printFile(result.transformed[0]);
        ts.sys.writeFile(
            file,
            prettier.format(transformed, { tabWidth: 4, printWidth: 120, singleQuote: true, parser: 'typescript' })
        );
    } else {
        // console.log('skipping', file);
        // console.count('skipped');
    }
}
function featureTransformer(context: ts.TransformationContext) {
    return (sourceFile: ts.SourceFile) => {
        const visitor = (node: ts.Node): ts.Node => {
            let newFeatureNode: ts.Node | undefined;
            let defaultExport = true;
            let className = '';
            // if (ts.isImportSpecifier(node)) {
            //     if (node.propertyName?.text === 'Feature') {
            //         return f.createImportSpecifier(node.isTypeOnly, f.createIdentifier('EngineFeature'), node.name);
            //     } else if (node.name.text === 'Feature') {
            //         return f.createImportSpecifier(node.isTypeOnly, undefined, f.createIdentifier('EngineFeature'));
            //     }
            // }
            if (ts.isVariableStatement(node) && node.declarationList.declarations.length === 1) {
                defaultExport = false;
                const onlyDecl = node.declarationList.declarations[0];
                newFeatureNode = onlyDecl.initializer;
                if (ts.isIdentifier(onlyDecl.name)) {
                    className = onlyDecl.name.text;
                }
            }
            if (ts.isExportAssignment(node) && ts.isNewExpression(node.expression)) {
                newFeatureNode = node.expression;
            }
            if (ts.isNewExpression(node) && node.parent && ts.isPropertyAccessExpression(node.parent)) {
                defaultExport = false;
                newFeatureNode = node;
            }
            if (isNewFeature(newFeatureNode)) {
                if (newFeatureNode.arguments && ts.isObjectLiteralExpression(newFeatureNode.arguments[0])) {
                    const { id, api, deps, context } = collectPointOfInterest(newFeatureNode.arguments[0]);
                    if (ts.isPropertyAccessExpression(newFeatureNode.parent)) {
                        return f.createParenthesizedExpression(
                            createNewFeatureClass(
                                id,
                                api,
                                deps,
                                context,
                                defaultExport,
                                className || toClassName(id),
                                'createClassExpression'
                            ) as ts.Expression
                        );
                    } else {
                        return createNewFeatureClass(
                            id,
                            api,
                            deps,
                            context,
                            defaultExport,
                            className || toClassName(id),
                            'createClassDeclaration'
                        );
                    }
                    return node;
                }
            } else {
                return ts.visitEachChild(node, visitor, context);
            }
            return node;
        };
        return ts.visitNode(sourceFile, visitor);
    };
}
function toClassName(id: {}): string {
    let n = typeof id === 'object' && 'text' in id ? String(id.text) : '';
    n = n.replace(/[^a-zA-Z0-9]/g, '_'); // replace non-alphanumeric characters with spaces
    // uppercase first letter
    return n.charAt(0).toUpperCase() + n.slice(1);
}
function isNewFeature(newFeatureNode: ts.Node | undefined): newFeatureNode is ts.NewExpression {
    return !!(
        newFeatureNode &&
        ts.isNewExpression(newFeatureNode) &&
        ts.isIdentifier(newFeatureNode.expression) &&
        newFeatureNode.expression.escapedText === 'Feature'
    );
}
function collectPointOfInterest(def: ts.ObjectLiteralExpression) {
    let id: unknown;
    let api: unknown;
    let deps: unknown;
    let context: unknown;
    for (const prop of def.properties) {
        if (!ts.isPropertyAssignment(prop)) {
            continue;
        }
        prop.initializer;
        const name = prop.name;
        if (!(name && ts.isIdentifier(name))) {
            continue;
        }
        if (name.text === 'id') {
            id = prop.initializer;
        } else if (name.text === 'api') {
            api = prop.initializer;
        } else if (name.text === 'dependencies') {
            deps = prop.initializer;
        } else if (name.text === 'context') {
            context = prop.initializer;
        } else {
            throw new Error(`Unknown property ${name.text}`);
        }
    }
    if (!id) {
        throw new Error('Feature missing id');
    }
    return { id, api, deps, context };
}
function createNewFeatureClass(
    id: any,
    api: any,
    deps: any,
    context: any,
    defaultExport = true,
    className: string,
    type: 'createClassExpression' | 'createClassDeclaration'
): ts.Node {
    const expr = f[type](
        defaultExport
            ? [f.createModifier(ts.SyntaxKind.ExportKeyword), f.createModifier(ts.SyntaxKind.DefaultKeyword)]
            : [],
        className ? f.createIdentifier(className) : undefined,
        undefined,
        [
            f.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
                f.createExpressionWithTypeArguments(f.createIdentifier('EngineFeature'), [f.createLiteralTypeNode(id)]),
            ]),
        ],
        [
            f.createPropertyDeclaration(
                undefined,
                f.createIdentifier('id'),
                undefined,
                undefined,
                f.createAsExpression(id, f.createTypeReferenceNode(f.createIdentifier('const'), undefined))
            ),

            deps
                ? f.createPropertyDeclaration(undefined, f.createIdentifier('dependencies'), undefined, undefined, deps)
                : [],
            api ? f.createPropertyDeclaration(undefined, f.createIdentifier('api'), undefined, undefined, api) : [],
            context
                ? f.createPropertyDeclaration(undefined, f.createIdentifier('context'), undefined, undefined, context)
                : [],
        ].flat()
    );
    return expr;
}
