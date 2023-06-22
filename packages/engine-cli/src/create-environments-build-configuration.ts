import { BuildOptions, Loader, Plugin } from 'esbuild';
import { IFeatureDefinition, getResolvedEnvironments, createMainEntrypoint } from '@wixc3/engine-scripts';

import { IConfigDefinition } from '@wixc3/engine-runtime-node';
import { SetMultiMap } from '@wixc3/patterns';
import { TopLevelConfig } from '@wixc3/engine-core';
import { createRequestResolver } from '@file-services/resolve';
import { topLevelConfigPlugin } from './top-level-config-plugin-esbuild';
import nodeFs from '@file-services/node';

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

    const webEntryPoints = new Map<string, string>();
    const nodeEntryPoints = new Map<string, string>();
    const browserTargets = concatIterables(environments.webEnvs.values(), environments.workerEnvs.values());
    const nodeTargets = concatIterables(environments.nodeEnvs.values(), environments.workerThreadEnvs.values());

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

        webEntryPoints.set(`${env.name}.${env.type === 'webworker' ? 'webworker' : 'web'}.js`, entrypointContent);
    }

    for (const { env, childEnvs } of nodeTargets) {
        const entrypointContent = `${childEnvs}`;

        nodeEntryPoints.set(`${env.name}.${env.type}.js`, entrypointContent);
    }

    const commonConfig = {
        target: 'es2020',
        bundle: true,
        format: 'iife',
        publicPath,
        metafile: true,
        sourcemap: true,
        keepNames: true,
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
        plugins: [...buildPlugins, rawLoaderPlugin(), topLevelConfigPlugin()],
    } satisfies BuildOptions;

    const webConfig = {
        ...commonConfig,
        platform: 'browser',
        outdir: 'dist-web',
        plugins: [
            ...commonConfig.plugins,
            nodeAliasPlugin(),
            dynamicEntryPlugin({ entryPoints: webEntryPoints, loader: 'js' }),
            // commonsPlugin(),
            htmlPlugin({
                toHtmlPath(key) {
                    const entry = webEntryPoints.get(key);
                    if (!entry) {
                        throw new Error(`Could not find entrypoint for ${key} in ${[...webEntryPoints.keys()]}}`);
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
        plugins: [...commonConfig.plugins, dynamicEntryPlugin({ entryPoints: webEntryPoints, loader: 'js' })],
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

function _commonsPlugin() {
    const plugin: Plugin = {
        name: 'commons-bundle',
        setup(build) {
            const externals = new Map<string, Set<string>>();
            build.onResolve({ filter: /^[a-z@]/ }, async (args) => {
                const request = args.path;
                if (request.includes('@wixc3')) {
                    return null;
                }
                const res = await build.resolve(request, {
                    kind: args.kind,
                    namespace: args.namespace,
                    pluginData: args.pluginData,
                    resolveDir: args.resolveDir,
                    importer: args.importer,
                });

                let paths = externals.get(request);
                if (!paths) {
                    paths = new Set<string>();
                    externals.set(res.path, paths);
                }
                paths.add(res.path);

                return {
                    ...res,
                    pluginData: {
                        args,
                    },
                    external: true,
                };
            });

            build.onLoad({ filter: /.*/, namespace: 'commons-bundle' }, (args) => {
                const pkgExports = '';
                return {
                    pluginData: args,
                    contents: `
                        import { ${pkgExports}, ${pkgExports}Default } from "commons-bundle";
                        export default ${pkgExports}Default;
                        export { ${pkgExports} };
                    `,
                };
            });

            build.onEnd(async () => {
                // const entryCode

                // entryPoints.set('commons', deindento(``));

                const res = await build.esbuild.build({
                    bundle: true,
                    format: 'esm',
                    splitting: false,
                    outdir: 'dist-web/commons',
                    metafile: true,
                    plugins: [nodeAliasPlugin(), dynamicEntryPlugin({ entryPoints: new Map(), loader: 'js' })],
                });

                console.log(res);
            });
        },
    };
    return plugin;
}

///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////

function nodeAliasPlugin() {
    const plugin: Plugin = {
        name: 'node-alias',
        setup(build) {
            const moduleCode = deindento(`
                |import path from '@file-services/path';
                |export * from '@file-services/path';
                |export default path;
            `);
            build.onResolve({ filter: /(^path$)/ }, (args) => {
                return {
                    path: args.path,
                    namespace: 'node-alias',
                    pluginData: { resolveDir: args.resolveDir },
                };
            });
            build.onLoad({ filter: /.*/, namespace: 'node-alias' }, ({ pluginData: { resolveDir } }) => {
                return {
                    contents: moduleCode,
                    loader: 'js',
                    resolveDir,
                };
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
            const resolve = createRequestResolver({ fs: nodeFs, alias: build.initialOptions.alias });

            build.onResolve({ filter: /^raw-loader!/ }, (args) => {
                return {
                    path: resolve(args.importer, args.path.replace(/^raw-loader!/, '')).resolvedFile || args.path,
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
