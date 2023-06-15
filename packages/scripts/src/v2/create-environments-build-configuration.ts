import { BuildOptions, Loader, Plugin } from 'esbuild';
import { getResolvedEnvironments } from '../utils/environments';
import { createMainEntrypoint } from '../create-entrypoint';
import { IFeatureDefinition } from '../types';
import { IConfigDefinition } from '@wixc3/engine-runtime-node';
import { SetMultiMap } from '@wixc3/patterns';
import { TopLevelConfig } from '@wixc3/engine-core';
import nodeFs from '@file-services/node';
import { createRequestResolver } from '@file-services/resolve';

interface Options {
    buildPlugins: Plugin[];
    configurations: SetMultiMap<string, IConfigDefinition>;
    features: Map<string, IFeatureDefinition>;
    publicPath: string;
    environments: ReturnType<typeof getResolvedEnvironments>;
    configLoaderRequest: string;
    config: TopLevelConfig;
}

export function createEnvironmentsBuildConfiguration(options: Options) {
    const { environments, publicPath, configLoaderRequest, features, configurations, config, buildPlugins } = options;
    const entryPoints = new Map<string, string>();
    const browserTargets = concatIterables(environments.webEnvs.values(), environments.workerEnvs.values());
    for (const { env, childEnvs } of browserTargets) {
        let entrypointContent = createMainEntrypoint({
            features,
            childEnvs,
            env,
            // featureName,
            // configName,
            publicPath,
            publicPathVariableName: 'PUBLIC_PATH',
            configurations,
            mode: 'development',
            staticBuild: true,
            publicConfigsRoute: '/configs',
            config,
            configLoaderModuleName: configLoaderRequest,
        });

        entrypointContent = 'import process from "process";\nglobalThis.process = process;\n' + entrypointContent;

        entryPoints.set(`${env.name}.${env.type === 'webworker' ? 'webworker' : 'web'}.js`, entrypointContent);
    }

    const commonConfig = {
        target: 'es2020',
        bundle: true,
        format: 'esm',
        publicPath,
        metafile: true,
        sourcemap: true,
        loader: {
            '.json': 'json',
            '.png': 'file',
            '.jpeg': 'file',
            '.jpg': 'file',
            '.svg': 'file',
            '.woff': 'file',
            '.woff2': 'file',
            '.ttf': 'file',
        },
        plugins: [tsconfigPathsPlugin({}), rawLoaderPlugin(), topLevelConfigPlugin(), ...buildPlugins],
    } satisfies BuildOptions;

    const webConfig = {
        ...commonConfig,
        platform: 'browser',
        outdir: 'dist-web',
        plugins: [
            nodeAliasPlugin(),
            ...commonConfig.plugins,
            dynamicEntryPlugin({ entryPoints, loader: 'js' }),
            htmlPlugin({
                toHtmlPath(key) {
                    const entry = entryPoints.get(key);
                    if (!entry) {
                        throw new Error(`Could not find entrypoint for ${key} in ${[...entryPoints.keys()]}}`);
                    }
                    const [envName] = key.split('.');
                    return `${envName}.html`;
                },
            }),
        ],
    } satisfies BuildOptions;

    const nodeConfig = {
        ...commonConfig,
        platform: 'node',
        outdir: 'dist-node',
        plugins: [...commonConfig.plugins],
    } satisfies BuildOptions;

    return {
        webConfig,
        nodeConfig,
    };
}

function* concatIterables<T>(...iterables: Iterable<T>[]) {
    for (const iterable of iterables) {
        yield* iterable;
    }
}

///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////

function nodeAliasPlugin() {
    const plugin: Plugin = {
        name: 'node-alias',
        setup(build) {
            build.onResolve({ filter: /(^path$)/ }, (args) => {
                return {
                    path: args.path,
                    namespace: 'node-alias',
                };
            });
            build.onLoad({ filter: /.*/, namespace: 'node-alias' }, () => {
                // if (args.path === 'path') {
                    return {
                        contents: deindento(`
                            |import path from '@file-services/path';
                            |export * from '@file-services/path';
                            |export default path;
                        `),
                        loader: 'js',
                        resolveDir: '.',
                    };
                // } 
                // else if (args.path === 'process') {
                //     return {
                //         contents: `export default {env:{}};`,
                //         loader: 'js',
                //         resolveDir: '.',
                //     };
                // } else {
                //     throw new Error(`Unknown path ${args.path}`);
                // }
            });
        },
    };
    return plugin;
}

///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////

function rawLoaderPlugin() {
    const plugin: Plugin = {
        name: 'raw-loader',
        setup(build) {
            const resolve = createRequestResolver({ fs: nodeFs });

            build.onResolve({ filter: /^raw-loader!/ }, (args) => {
                return {
                    path: resolve(args.path.replace(/^raw-loader!/, ''), args.importer).resolvedFile || args.path,
                    namespace: 'raw-loader-ns',
                };
            });
            build.onLoad({ filter: /.*/, namespace: 'raw-loader-ns' }, (args) => {
                const content = nodeFs.readFileSync(args.path, 'utf8');
                return {
                    contents: `export default ${JSON.stringify(content)};`,
                    loader: 'js',
                };
            });
        },
    };
    return plugin;
}

///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////

function htmlPlugin({ toHtmlPath = (key: string) => key.replace(/\.m?js$/, '.html') } = {}) {
    const plugin: Plugin = {
        name: 'html-plugin',
        setup(build) {
            build.onEnd(({ metafile, errors }) => {
                if (errors.length > 0) {
                    return {
                        errors: [
                            {
                                text: "html-plugin: build failed, can't generate html files.",
                            },
                        ],
                    };
                }
                if (!metafile) {
                    throw new Error('metafile must be set when using html-plugin');
                }
                const cwd = build.initialOptions.absWorkingDir || process.cwd();
                for (const [key, meta] of Object.entries(metafile.outputs)) {
                    if (!key.match(/\.m?js$/)) {
                        continue;
                    }
                    const jsPath = nodeFs.basename(key);
                    const jsDir = nodeFs.dirname(key);
                    const htmlFile = nodeFs.join(jsDir, toHtmlPath(jsPath));
                    const cssPath = meta.cssBundle ? nodeFs.basename(meta.cssBundle) : undefined;
                    const htmlContent = deindento(`
                        |<!DOCTYPE html>
                        |<html>
                        |    <head>
                        |        <meta charset="utf-8" />
                        |        <meta name="viewport" content="width=device-width, initial-scale=1" />
                        |        <title>Wixc3</title>
                        |        ${cssPath ? `<link rel="stylesheet" href="${cssPath}" />` : ''}
                        |    </head>
                        |    <body>
                        |        <script>window.__webpack_public_path__ = ''</script>
                        |        <script type="module" src="${jsPath}" crossorigin="anonymous"></script>
                        |    </body>
                        |</html>
                    `);
                    nodeFs.writeFileSync(nodeFs.join(cwd, htmlFile), htmlContent);
                }
                return null;
            });
        },
    };
    return plugin;
}

function deindento(str: string) {
    const lines = str
        .trim()
        .split('\n')
        .map((line) => line.replace(/^\s*\|/, ''))
        .filter((line) => line.trim() !== '');

    return lines.join('\n');
}

///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////

function dynamicEntryPlugin({
    entryPoints,
    loader = undefined,
}: {
    entryPoints: Map<string, string>;
    loader?: Loader;
}) {
    const plugin: Plugin = {
        name: 'dynamic-entry',
        setup(build) {
            if (build.initialOptions.entryPoints) {
                throw new Error(`dynamicEntryPlugin: entryPoints must not be set when using dynamicEntryPlugin`);
            }

            build.initialOptions.entryPoints = Array.from(entryPoints.keys()).map((key) => `@@entry/${key}`);

            build.onResolve({ filter: /^@@entry/ }, (args) => {
                return {
                    path: args.path.replace(/^@@entry\//, ''),
                    namespace: 'dynamic-entry-ns',
                };
            });

            build.onLoad({ filter: /.*/, namespace: 'dynamic-entry-ns' }, (args) => {
                return {
                    resolveDir: '.',
                    loader: loader || 'tsx',
                    contents: entryPoints.get(args.path),
                };
            });
        },
    };
    return plugin;
}

///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////

import {
    nodeModuleNameResolver,
    sys,
    findConfigFile,
    readJsonConfigFile,
    parseJsonSourceFileConfigFileContent,
} from 'typescript';
import { topLevelConfigPlugin } from './top-level-config-plugin-esbuild';

interface TsConfigPluginOptions {
    absolute?: boolean;
    tsconfig?: Tsconfig | string;
}

interface Tsconfig {
    baseUrl?: string;
    compilerOptions?: {
        paths?: Record<string, string[]>;
    };
}

function tsconfigPathsPlugin({ absolute = true, tsconfig }: TsConfigPluginOptions): Plugin {
    return {
        name: 'tsconfig-paths',
        setup: function setup({ onResolve }) {
            const compilerOptions = loadCompilerOptions(tsconfig);
            onResolve({ filter: /.*/ }, (args) => {
                const hasMatchingPath = Object.keys(compilerOptions?.paths || {}).some((path) =>
                    new RegExp(path.replace('*', '\\w*')).test(args.path)
                );

                if (!hasMatchingPath) {
                    return null;
                }

                const { resolvedModule } = nodeModuleNameResolver(args.path, args.importer, compilerOptions || {}, sys);

                if (!resolvedModule) {
                    return null;
                }

                const { resolvedFileName } = resolvedModule;

                if (!resolvedFileName || resolvedFileName.endsWith('.d.ts')) {
                    return null;
                }

                const resolved = absolute ? sys.resolvePath(resolvedFileName) : resolvedFileName;

                return {
                    path: resolved,
                };
            });
        },
    };
}

function loadCompilerOptions(tsconfig?: Tsconfig | string) {
    if (!tsconfig || typeof tsconfig === 'string') {
        const tsconfigPath = findConfigFile(process.cwd(), sys.fileExists, tsconfig);
        if (!tsconfigPath) {
            throw new Error(`Cannot find tsconfig at '${tsconfig}'`);
        }
        const jsonSourceFile = readJsonConfigFile(tsconfigPath, sys.readFile);
        return parseJsonSourceFileConfigFileContent(jsonSourceFile, sys, nodeFs.dirname(tsconfigPath)).options;
    } else if (tsconfig) {
        return tsconfig.compilerOptions;
    } else {
        throw new Error(`Cannot load tsconfig`);
    }
}
