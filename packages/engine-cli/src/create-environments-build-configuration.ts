import fs from '@file-services/node';
import { createRequestResolver } from '@file-services/resolve';
import { TopLevelConfig } from '@wixc3/engine-core';
import { IConfigDefinition } from '@wixc3/engine-runtime-node';
import {
    IFeatureDefinition,
    createMainEntrypoint,
    createNodeEntrypoint,
    createNodeEnvironmentManagerEntrypoint,
    getResolvedEnvironments,
} from '@wixc3/engine-scripts';
import { SetMultiMap } from '@wixc3/patterns';
import { BuildOptions, Loader, Plugin } from 'esbuild';
import { topLevelConfigPlugin } from './top-level-config-plugin-esbuild';
import { join } from 'node:path';

export interface CreateEnvBuildConfigOptions {
    dev: boolean;
    buildPlugins: Plugin[];
    configurations: SetMultiMap<string, IConfigDefinition>;
    features: Map<string, IFeatureDefinition>;
    publicPath: string;
    environments: ReturnType<typeof getResolvedEnvironments>;
    config: TopLevelConfig;
    outputPath: string;
    featureName?: string;
    configName?: string;
}

export function createEnvironmentsBuildConfiguration(options: CreateEnvBuildConfigOptions) {
    const {
        dev,
        featureName,
        configName,
        outputPath,
        environments,
        publicPath,
        features,
        configurations,
        config,
        buildPlugins,
    } = options;

    const jsOutExtension = '.mjs';
    const webEntryPoints = new Map<string, string>();
    const nodeEntryPoints = new Map<string, string>([
        [`engine-environment-manager${jsOutExtension}`, createNodeEnvironmentManagerEntrypoint({ features })],
    ]);
    const browserTargets = concatIterables(environments.webEnvs.values(), environments.workerEnvs.values());
    const nodeTargets = concatIterables(environments.nodeEnvs.values(), environments.workerThreadEnvs.values());

    for (const { env, childEnvs } of browserTargets) {
        const entrypointContent = createMainEntrypoint({
            features,
            childEnvs,
            env,
            featureName,
            configName,
            publicPath,
            publicPathVariableName: 'PUBLIC_PATH',
            configurations,
            mode: 'development',
            staticBuild: true,
            publicConfigsRoute: '/configs',
            config,
        });

        webEntryPoints.set(
            `${env.name}.${env.type === 'webworker' ? 'webworker' : 'web'}${jsOutExtension}`,
            entrypointContent
        );
    }

    for (const { env, childEnvs } of nodeTargets) {
        const entrypointContent = createNodeEntrypoint({
            features,
            childEnvs,
            env,
            featureName,
            configName,
            configurations,
            mode: 'development',
            staticBuild: true,
            publicConfigsRoute: '/configs',
            config,
        });
        nodeEntryPoints.set(`${env.name}.${env.type}${jsOutExtension}`, entrypointContent);
    }

    const commonConfig = {
        target: 'es2020',
        bundle: true,
        format: 'esm',
        publicPath,
        metafile: true,
        sourcemap: true,
        keepNames: true,
        outExtension: { '.js': jsOutExtension },
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
        plugins: [...buildPlugins, rawLoaderPlugin(), topLevelConfigPlugin({ emit: !dev })],
    } satisfies BuildOptions;

    const webConfig = {
        ...commonConfig,
        platform: 'browser',
        outdir: join(outputPath, 'web'),
        plugins: [
            ...commonConfig.plugins,
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
        outdir: join(outputPath, 'node'),
        plugins: [...commonConfig.plugins, dynamicEntryPlugin({ entryPoints: nodeEntryPoints, loader: 'js' })],
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
                    plugins: [dynamicEntryPlugin({ entryPoints: new Map(), loader: 'js' })],
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

function rawLoaderPlugin() {
    const plugin: Plugin = {
        name: 'raw-loader',
        setup(build) {
            const resolve = createRequestResolver({ fs: fs, alias: build.initialOptions.alias });

            build.onResolve({ filter: /^raw-loader!/ }, (args) => {
                return {
                    path: resolve(args.importer, args.path.replace(/^raw-loader!/, '')).resolvedFile || args.path,
                    namespace: 'raw-loader-ns',
                };
            });
            build.onLoad({ filter: /.*/, namespace: 'raw-loader-ns' }, (args) => {
                const content = fs.readFileSync(args.path, 'utf8');
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
                    const jsPath = fs.basename(key);
                    const jsDir = fs.dirname(key);
                    const htmlFile = fs.join(jsDir, toHtmlPath(jsPath));
                    const cssPath = meta.cssBundle ? fs.basename(meta.cssBundle) : undefined;
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
                    fs.writeFileSync(fs.join(cwd, htmlFile), htmlContent);
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