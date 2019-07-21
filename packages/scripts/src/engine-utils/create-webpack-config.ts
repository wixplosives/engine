import { StylableWebpackPlugin } from '@stylable/webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import { EngineEnvironmentEntry, WebpackEnvOptions } from '../types';
import { inOwnRepo } from '../utils/own-repo-hook';
import { EnvironmentEntryBuilder } from './environment-entry-builder';
import { WorkerEntryPointPlugin } from './worker-plugin';

const resolveOptions: webpack.Resolve = inOwnRepo
    ? {
          alias: { '@wixc3/engine-core': '@wixc3/engine-core/src' }
      }
    : {};

/**
 * Create webpack config to a single engine entry.
 * we should be more creative in the future and not create entry for each file
 */
export function createEnvWebpackConfig({
    port,
    environments,
    basePath,
    outputPath
}: WebpackEnvOptions): webpack.Configuration {
    const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    const { virtualEntries, virtualSources, workerPlugins, htmlPlugins } = createWebEntries(environments, port);
    return getWebWebpackConfig(mode, basePath, outputPath, virtualEntries, virtualSources, htmlPlugins, workerPlugins);
}

export function createStaticWebpackConfigs({
    environments,
    basePath,
    outputPath,
    currentFeatureName,
    currentConfigName
}: Pick<WebpackEnvOptions, 'basePath' | 'outputPath' | 'environments'> & {
    currentFeatureName: string;
    currentConfigName: string;
}): webpack.Configuration[] {
    const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    const publicPath = process.env.PUBLIC_PATH;

    const {
        virtualWebEntries,
        virtualWebSources,
        workerPlugins,
        htmlPlugins,
        virtualNodeEntries,
        virtualNodeSources
    } = createStaticEntries({
        environments,
        currentFeatureName,
        currentConfigName,
        publicPath
    });

    const webpackWebConfig = getWebWebpackConfig(
        mode,
        basePath,
        outputPath,
        virtualWebEntries,
        virtualWebSources,
        htmlPlugins,
        workerPlugins,
        publicPath
    );

    const webpackNodeConfig =
        Object.keys(virtualNodeEntries).length > 0
            ? getNodeWebpackConfig(mode, basePath, outputPath, virtualNodeEntries, virtualNodeSources)
            : {};

    return [webpackWebConfig, webpackNodeConfig];
}

function createWebEntries(environments: EngineEnvironmentEntry[], port?: number) {
    const virtualSources: Record<string, string> = {};
    const virtualEntries: Record<string, string> = {};
    const htmlPlugins: webpack.Plugin[] = [];
    const workerPlugins: WorkerEntryPointPlugin[] = [];
    const topology = environments
        .filter(({ target }) => target === 'node')
        .map(({ name }) => name)
        .reduce<Record<string, string>>((topologyReucer, name) => {
            topologyReucer[name] = `http://localhost:${port}/_ws`;
            return topologyReucer;
        }, {});

    const contextEntities = groupContextEntitiesByEnvNameAndTarget(environments);

    for (const { isRoot, envFiles, featureMapping, target, name, entryFilename } of environments) {
        // console.log(name, target, contextEntities[name][target]);
        const virtualEntry = {
            source: new EnvironmentEntryBuilder().buildDynamic(
                {
                    envFiles,
                    featureMapping,
                    name,
                    target,
                    contextFiles: contextEntities[name] ? contextEntities[name][target] : undefined
                },
                topology
            ),
            filename: entryFilename
        };
        const id = `${name}-${target}`;
        const { filename: virtualEntryFilename, source: virtualEntrySource } = virtualEntry;
        if (target === 'web') {
            virtualEntries[id] = `./${virtualEntryFilename}`;
            if (isRoot) {
                htmlPlugins.push(
                    ...[
                        new HtmlWebpackPlugin({
                            chunks: [id],
                            filename: name + '.html',
                            templateContent: '',
                            inject: 'body'
                        })
                    ]
                );
            }
        } else if (target === 'webworker') {
            workerPlugins.push(
                new WorkerEntryPointPlugin({
                    id,
                    entry: `./${virtualEntryFilename}`,
                    filename: `${id}.js`,
                    chunkFilename: '[name].webworker.js'
                })
            );
        }

        virtualSources[virtualEntryFilename] = virtualEntrySource;
    }
    return { virtualEntries, virtualSources, workerPlugins, htmlPlugins };
}

function groupContextEntitiesByEnvNameAndTarget(environments: EngineEnvironmentEntry[]) {
    return environments
        .map(({ contextFiles, target, name }) => {
            return { contextFiles, target, name };
        })
        .reduce(
            (prev, { name, target, contextFiles }) => {
                if (contextFiles) {
                    if (!prev[name]) {
                        prev[name] = {};
                    }
                    prev[name][target] = contextFiles;
                }
                return prev;
            },
            {} as Record<string, Record<string, Set<string> | undefined>>
        );
}

function createStaticEntries({
    environments,
    currentConfigName,
    currentFeatureName,
    publicPath = '/'
}: {
    environments: EngineEnvironmentEntry[];
    currentFeatureName: string;
    currentConfigName: string;
    publicPath?: string;
}) {
    const virtualWebEntries: Record<string, string> = {};
    const htmlPlugins: webpack.Plugin[] = [];
    const workerPlugins: WorkerEntryPointPlugin[] = [];
    const virtualWebSources: Record<string, string> = {};
    const virtualNodeEntries: Record<string, string> = {};
    const virtualNodeSources: Record<string, string> = {};

    const contextEntities = groupContextEntitiesByEnvNameAndTarget(environments);

    for (const { isRoot, envFiles, featureMapping, target, name, entryFilename } of environments) {
        const virtualEntry = {
            source: new EnvironmentEntryBuilder().buildStaticEntities({
                envFiles,
                featureMapping,
                name,
                target,
                currentConfigName,
                currentFeatureName,
                publicPath,
                contextFiles: contextEntities[name] ? contextEntities[name][target] : undefined
            }),
            filename: entryFilename
        };

        const id = `${name}-${target}`;
        const { filename: virtualEntryFilename, source: virtualEntrySource } = virtualEntry;

        if (target === 'web') {
            virtualWebEntries[id] = `./${virtualEntryFilename}`;
            if (isRoot) {
                htmlPlugins.push(
                    new HtmlWebpackPlugin({
                        chunks: [id],
                        filename: name + '.html',
                        templateContent: '',
                        inject: 'body'
                    })
                );
            }
        } else if (target === 'webworker') {
            workerPlugins.push(
                new WorkerEntryPointPlugin({
                    id,
                    entry: `./${virtualEntryFilename}`,
                    filename: `${id}.js`,
                    chunkFilename: '[name].webworker.js'
                })
            );
        }
        if (target !== 'node') {
            virtualWebSources[virtualEntryFilename] = virtualEntrySource;
        } else {
            virtualNodeEntries[id] = `./${virtualEntryFilename}`;
            virtualNodeSources[virtualEntryFilename] = virtualEntrySource;
        }
    }

    return {
        virtualWebEntries,
        virtualNodeEntries,
        virtualNodeSources,
        virtualWebSources,
        workerPlugins,
        htmlPlugins
    };
}

function getWebWebpackConfig(
    mode: 'production' | 'development',
    basePath: string,
    outputPath: string,
    virtualEntries: Record<string, string>,
    virtualSources: Record<string, string>,
    htmlPlugins: webpack.Plugin[],
    workerPlugins: WorkerEntryPointPlugin[],
    publicPath: string = '/'
): webpack.Configuration {
    return {
        mode,
        target: 'web',
        devtool: 'source-map',
        context: basePath,
        entry: virtualEntries,
        output: {
            path: outputPath,
            chunkFilename: `[name].web.js`,
            publicPath
        },
        resolve: {
            ...resolveOptions,
            extensions: ['.ts', '.tsx', '.js']
        },
        module: {
            noParse: [/typescript[\\/]lib[\\/]typescript\.js/],
            rules: [
                {
                    test: /\.tsx?$/,
                    exclude: /\.d\.ts$/,
                    loader: '@ts-tools/webpack-loader',
                    options: {
                        typeCheck: false
                    }
                },
                {
                    test: /\.css$/,
                    exclude: /\.st\.css$/,
                    use: ['style-loader', 'css-loader']
                },
                {
                    test: /\.(png|jpg|gif|svg)$/i,
                    use: [
                        {
                            loader: 'url-loader',
                            options: {
                                limit: 2048
                            }
                        }
                    ]
                }
            ]
        },
        plugins: [
            // new BundleAnalyzer(),
            new VirtualModulesPlugin(virtualSources),
            new StylableWebpackPlugin({
                useEntryModuleInjection: true
            }),
            ...htmlPlugins,
            ...workerPlugins
        ]
    };
}

function getNodeWebpackConfig(
    mode: 'production' | 'development',
    basePath: string,
    outputPath: string,
    virtualEntries: Record<string, string>,
    virtualSources: Record<string, string>
): webpack.Configuration {
    return {
        mode,
        target: 'node',
        devtool: 'source-map',
        context: basePath,
        entry: virtualEntries,
        output: {
            path: `${outputPath}/server`,
            chunkFilename: `[name].node.js`,
            libraryTarget: 'umd'
        },
        resolve: {
            ...resolveOptions,
            extensions: ['.ts', '.tsx', '.js']
        },
        module: {
            noParse: [/typescript[\\/]lib[\\/]typescript\.js/],
            rules: [
                {
                    test: /\.d\.ts$/,
                    loader: 'raw-loader'
                },
                {
                    test: /\.tsx?$/,
                    exclude: /\.d\.ts$/,
                    loader: '@ts-tools/webpack-loader',
                    options: {
                        typeCheck: false
                    }
                }
            ]
        },
        externals: ['utf-8-validate', 'bufferutil'],
        plugins: [
            // new BundleAnalyzer(),
            new VirtualModulesPlugin(virtualSources),
            new StylableWebpackPlugin({
                includeCSSInJS: false,
                bootstrap: { autoInit: false },
                outputCSS: false,
                useEntryModuleInjection: true
            })
        ]
    };
}
