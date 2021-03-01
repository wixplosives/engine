import { promisify } from 'util';
import express from 'express';
import rimrafCb from 'rimraf';
import webpack from 'webpack';
import fs from '@file-services/node';
import type io from 'socket.io';
import { TopLevelConfig, SetMultiMap, flattenTree, createDisposables } from '@wixc3/engine-core';

import { loadFeaturesFromPackages } from './analyze-feature';
import { ENGINE_CONFIG_FILE_NAME } from './build-constants';
import {
    createConfigMiddleware,
    createCommunicationMiddleware,
    ensureTopLevelConfigMiddleware,
} from './config-middleware';
import {
    createWebpackConfig,
    createWebpackConfigForExteranlFeature,
    createWebpackConfigs,
} from './create-webpack-configs';
import { ForkedProcess } from './forked-process';
import { NodeEnvironmentsManager, LaunchEnvironmentMode } from './node-environments-manager';
import { createIPC } from './process-communication';
import type {
    EngineConfig,
    IConfigDefinition,
    IEnvironment,
    IFeatureDefinition,
    IFeatureTarget,
    IExternalDefinition,
    TopLevelConfigProvider,
    IExtenalFeatureDescriptor,
} from './types';
import { resolvePackages } from './utils/resolve-packages';
import { generateFeature, pathToFeaturesDirectory } from './feature-generator';
import { getEnvironmntsForFeature, getResolvedEnvironments } from './utils/environments';
import { launchHttpServer } from './launch-http-server';
import { getExternalFeaturesMetadata } from './utils';
import { createExternalNodeEntrypoint } from './create-entrypoint';
import { EXTERNAL_FEATURES_BASE_URI } from './build-constants';
import type { IFileSystemSync } from '@file-services/types';

const rimraf = promisify(rimrafCb);
const { basename, extname, join } = fs;

const builtinTemplatesPath = fs.join(__dirname, '../templates');

export interface IRunFeatureOptions extends IFeatureTarget {
    featureName: string;
}

export interface IRunApplicationOptions extends IFeatureTarget {
    singleRun?: boolean;
    singleFeature?: boolean;
    inspect?: boolean;
    port?: number;
    publicPath?: string;
    mode?: 'development' | 'production';
    title?: string;
    publicConfigsRoute?: string;
    nodeEnvironmentsMode?: LaunchEnvironmentMode;
    autoLaunch?: boolean;
    socketServerOptions?: Partial<io.ServerOptions>;
    webpackConfigPath?: string;
}

export interface IBuildCommandOptions extends IRunApplicationOptions {
    external?: boolean;
    staticBuild?: boolean;
    withExternalFeatures?: boolean;
    fetchExternalFeatures?: boolean;
    featureOutDir?: string;
    externalFeaturesPath?: string;
    eagerEntrypoint?: boolean;
    favicon?: string;
}

export interface IRunCommandOptions extends IRunApplicationOptions {
    serveExternalFeaturesPath?: boolean;
    externalFeaturesPath?: string;
    externalFeatureDefinitions?: IExternalDefinition[];
}

export interface IBuildManifest {
    features: Array<[string, IFeatureDefinition]>;
    defaultFeatureName?: string;
    defaultConfigName?: string;
    entryPoints: Record<string, Record<string, string>>;
}

export interface ICreateOptions {
    featureName?: string;
    templatesDir?: string;
    featuresDir?: string;
}

export interface IApplicationOptions {
    basePath?: string;
    outputPath?: string;
    featureDiscoveryRoot?: string;
}

export interface ICompilerOptions {
    features: Map<string, IFeatureDefinition>;
    featureName?: string;
    configName?: string;
    publicPath?: string;
    mode?: 'production' | 'development';
    title?: string;
    favicon?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    singleFeature?: boolean;
    isExternal: boolean;
    externalFeatures: IExtenalFeatureDescriptor[];
    useLocalExtenalFeaturesMapping?: boolean;
    webpackConfigPath?: string;
    environments: Pick<ReturnType<typeof getResolvedEnvironments>, 'electronRendererEnvs' | 'workerEnvs' | 'webEnvs'>;
    eagerEntrypoint?: boolean;
}

export class Application {
    public outputPath: string;
    protected basePath: string;
    protected featureDiscoveryRoot?: string;

    constructor({
        basePath = process.cwd(),
        outputPath = fs.join(basePath, 'dist'),
        featureDiscoveryRoot,
    }: IApplicationOptions) {
        this.basePath = basePath;
        this.outputPath = outputPath;
        this.featureDiscoveryRoot = featureDiscoveryRoot;
    }

    public async clean() {
        await rimraf(this.outputPath);
        await rimraf(fs.join(this.basePath, 'npm'));
    }

    public async build({
        featureName,
        configName,
        publicPath,
        mode = 'production',
        singleFeature,
        title,
        favicon,
        publicConfigsRoute,
        overrideConfig,
        external = false,
        staticBuild = true,
        withExternalFeatures = false,
        fetchExternalFeatures,
        webpackConfigPath,
        featureOutDir,
        externalFeaturesPath,
        eagerEntrypoint,
    }: IBuildCommandOptions = {}): Promise<webpack.compilation.MultiStats> {
        const { config, path: configPath } = await this.getEngineConfig();
        const {
            require,
            externalFeatureDefinitions,
            externalFeaturesPath: configExternalFeaturesPath,
            featureOutDir: configFeatureOutDir,
            favicon: configFavicon,
        } = config ?? {};
        if (require) {
            await this.importModules(require);
        }
        const entryPoints: Record<string, Record<string, string>> = {};

        if (external && !featureName) {
            throw new Error('You must specify a feature name when building a feature in external mode');
        }

        const { features, configurations } = this.analyzeFeatures();
        if (singleFeature && featureName) {
            this.filterByFeatureName(features, featureName);
        }

        const resolvedEnvironments = getResolvedEnvironments({
            featureName,
            features,
            filterContexts: external ? false : singleFeature,
            environments: [...getExportedEnvironments(features)],
        });

        const resolvedExternalFeaturesPath = fs.resolve(
            externalFeaturesPath ?? (configExternalFeaturesPath ? fs.dirname(configPath!) : this.basePath)
        );

        const compiler = this.createCompiler({
            mode,
            features,
            featureName,
            configName,
            publicPath,
            title,
            favicon: favicon ?? configFavicon,
            configurations,
            staticBuild,
            publicConfigsRoute,
            overrideConfig,
            singleFeature,
            // should build this feature in external mode
            isExternal: external,
            // external features to prepend to the built output
            externalFeatures:
                withExternalFeatures && externalFeatureDefinitions
                    ? getExternalFeaturesMetadata(externalFeatureDefinitions, resolvedExternalFeaturesPath)
                    : [],
            // whether should fetch at runtime for the external features metadata
            useLocalExtenalFeaturesMapping: fetchExternalFeatures ?? !withExternalFeatures,
            webpackConfigPath,
            environments: resolvedEnvironments,
            eagerEntrypoint,
        });
        const outDir = fs.basename(this.outputPath);

        const stats = await new Promise<webpack.compilation.MultiStats>((resolve, reject) =>
            compiler.run((e, s) => {
                if (e) {
                    reject(e);
                } else if (s.hasErrors()) {
                    reject(new Error(s.toString('errors-warnings')));
                } else {
                    resolve(s);
                }
            })
        );

        if (external) {
            const providedOutDir = featureOutDir || configFeatureOutDir || '.';
            // The node entry is created inside the outDir, and requires the mentioned feature file (as well as environment files)
            // in order to properly import from the entry the required files, we are resolving the featureOutDir with the basePath (the root of the package) and the outDir - the location where the node entry will be created to
            const relativeFeatureOutDir =
                // if a === b then fs.relative(a, b) === ''. this is why a fallback to "."
                fs.relative(this.outputPath, fs.resolve(this.basePath, providedOutDir)) || '.';
            const { nodeEnvs, electronRendererEnvs, webEnvs, workerEnvs } = resolvedEnvironments;
            this.createNodeEntries(features, featureName!, resolvedEnvironments.nodeEnvs, relativeFeatureOutDir);
            getEnvEntrypoints(nodeEnvs.keys(), 'node', entryPoints, outDir);
            getEnvEntrypoints(electronRendererEnvs.keys(), 'electron-renderer', entryPoints, outDir);
            getEnvEntrypoints(webEnvs.keys(), 'web', entryPoints, outDir);
            getEnvEntrypoints(workerEnvs.keys(), 'webworker', entryPoints, outDir);
        }

        await this.writeManifest({
            features,
            featureName,
            configName,
            entryPoints,
        });

        return stats;
    }

    public async run(runOptions: IRunCommandOptions = {}) {
        const { defaultConfigName, defaultFeatureName, features: manifestFeatures } = (await fs.promises.readJsonFile(
            join(this.outputPath, 'manifest.json')
        )) as IBuildManifest;

        const features = this.remapManifestFeaturePaths(manifestFeatures);

        const {
            configName = defaultConfigName,
            featureName = defaultFeatureName,
            runtimeOptions: defaultRuntimeOptions,
            inspect,
            port: httpServerPort,
            overrideConfig: userConfig = [],
            publicPath,
            publicConfigsRoute,
            nodeEnvironmentsMode = 'new-server',
            autoLaunch = true,
            externalFeaturesPath: providedExternalFeatuersPath,
            serveExternalFeaturesPath: providedServeExternalFeaturesPath = true,
            externalFeatureDefinitions: providedExternalFeaturesDefinitions = [],
            socketServerOptions: runtimeSocketServerOptions,
        } = runOptions;
        const { config: engineConfig, path: configPath } = await this.getEngineConfig();

        const disposables = createDisposables();
        const configurations = await this.readConfigs();
        const socketServerOptions = { ...runtimeSocketServerOptions, ...engineConfig?.socketServerOptions };
        const { port, close, socketServer, app } = await launchHttpServer({
            staticDirPath: this.outputPath,
            httpServerPort,
            socketServerOptions,
        });
        const config: TopLevelConfig = [...(Array.isArray(userConfig) ? userConfig : [])];
        disposables.add(close);

        const {
            externalFeatureDefinitions = [],
            externalFeaturesPath: baseExternalFeaturesPath,
            serveExternalFeaturesPath = providedServeExternalFeaturesPath,
            serveStatic = [],
            socketServerOptions: configSocketServerOptions,
        } = engineConfig ?? {};

        const resolvedExternalFeaturesPath = fs.resolve(
            providedExternalFeatuersPath ??
                baseExternalFeaturesPath ??
                (configPath ? fs.dirname(configPath) : this.basePath)
        );

        const fixedExternalFeatureDefinitions = this.normilizeDefinitionsPackagePath(
            [...providedExternalFeaturesDefinitions, ...externalFeatureDefinitions],
            providedExternalFeatuersPath,
            baseExternalFeaturesPath,
            configPath
        );

        if (serveExternalFeaturesPath) {
            for (const { packageName, packagePath } of fixedExternalFeatureDefinitions) {
                if (packagePath) {
                    serveStatic.push({
                        route: `/${EXTERNAL_FEATURES_BASE_URI}/${packageName}`,
                        directoryPath: fs.resolve(packagePath),
                    });
                }
            }
        }

        if (serveStatic.length) {
            for (const { route, directoryPath } of serveStatic) {
                app.use(route, express.static(directoryPath));
            }
        }

        fixedExternalFeatureDefinitions.push(
            ...this.normilizeDefinitionsPackagePath(
                providedExternalFeaturesDefinitions,
                providedExternalFeatuersPath,
                baseExternalFeaturesPath,
                configPath
            )
        );

        const externalFeatures = getExternalFeaturesMetadata(
            fixedExternalFeatureDefinitions,
            resolvedExternalFeaturesPath
        );

        const nodeEnvironmentManager = new NodeEnvironmentsManager(
            socketServer,
            {
                features,
                port,
                defaultRuntimeOptions,
                inspect,
                overrideConfig: config,
                configurations,
                externalFeatures,
            },
            { ...socketServerOptions, ...configSocketServerOptions }
        );

        disposables.add(() => nodeEnvironmentManager.closeAll());

        if (publicConfigsRoute) {
            app.use(`/${publicConfigsRoute}`, [
                ensureTopLevelConfigMiddleware,
                createCommunicationMiddleware(nodeEnvironmentManager, publicPath),
                createConfigMiddleware(config),
            ]);
        }

        app.use('/external', (_, res) => {
            res.json(externalFeatures);
        });
        if (autoLaunch && featureName) {
            await nodeEnvironmentManager.runServerEnvironments({
                featureName,
                configName,
                mode: nodeEnvironmentsMode,
            });
        }

        return {
            port,
            router: app,
            nodeEnvironmentManager,
            close: disposables.dispose,
        };
    }

    private remapManifestFeaturePaths(manifestFeatures: [string, IFeatureDefinition][]) {
        const features = new Map<string, IFeatureDefinition>();
        for (const [featureName, featureDef] of manifestFeatures) {
            const { filePath, envFilePaths, contextFilePaths, preloadFilePaths } = featureDef;
            features.set(featureName, {
                ...featureDef,
                filePath: require.resolve(filePath, { paths: [this.outputPath] }),
                envFilePaths: this.resolveManifestPaths(envFilePaths),
                contextFilePaths: this.resolveManifestPaths(contextFilePaths),
                preloadFilePaths: this.resolveManifestPaths(preloadFilePaths),
            });
        }
        return features;
    }

    private resolveManifestPaths(envFilePaths: Record<string, string>): Record<string, string> {
        return Object.fromEntries(
            Object.entries(envFilePaths).map<[string, string]>(([envName, filePath]) => [
                envName,
                require.resolve(filePath, { paths: [this.outputPath] }),
            ])
        );
    }

    protected normilizeDefinitionsPackagePath(
        externalFeatureDefinitions: IExternalDefinition[],
        providedExternalFeatuersPath: string | undefined,
        baseExternalFeaturesPath: string | undefined,
        configPath: string | undefined
    ) {
        return externalFeatureDefinitions.map((def) => {
            const { outDir, packagePath, packageName } = def;
            return {
                outDir,
                packageName,
                packagePath:
                    packagePath ??
                    fs.dirname(
                        require.resolve(fs.join(packageName, 'package.json'), {
                            paths: [
                                providedExternalFeatuersPath ??
                                    (baseExternalFeaturesPath ? configPath! : this.basePath),
                            ],
                        })
                    ),
            };
        });
    }

    public async remote({ port: preferredPort, socketServerOptions }: IRunApplicationOptions = {}) {
        if (!process.send) {
            throw new Error('"remote" command can only be used in a forked process');
        }
        const { config } = await this.getEngineConfig();
        if (config && config.require) {
            await this.importModules(config.require);
        }
        const { socketServer, close, port } = await launchHttpServer({
            staticDirPath: this.outputPath,
            httpServerPort: preferredPort,
            socketServerOptions,
        });

        const parentProcess = new ForkedProcess(process);
        createIPC(parentProcess, socketServer, { port, onClose: close });

        parentProcess.postMessage({ id: 'initiated' });
    }

    public async create({ featureName, templatesDir, featuresDir }: ICreateOptions = {}) {
        if (!featureName) {
            throw new Error('Feature name is mandatory');
        }

        const { config } = await this.getEngineConfig();

        const targetPath = pathToFeaturesDirectory(fs, this.basePath, config?.featuresDirectory || featuresDir);
        const featureDirNameTemplate = config?.featureFolderNameTemplate;
        const userTemplatesDirPath = config?.featureTemplatesFolder || templatesDir;
        const templatesDirPath = userTemplatesDirPath
            ? fs.join(this.basePath, userTemplatesDirPath)
            : builtinTemplatesPath;

        generateFeature({
            fs,
            featureName,
            targetPath,
            templatesDirPath,
            featureDirNameTemplate,
        });
    }

    protected async getEngineConfig(): Promise<{ config?: EngineConfig; path?: string }> {
        const engineConfigFilePath = await this.getClosestEngineConfigPath();
        if (engineConfigFilePath) {
            try {
                return {
                    config: (await import(engineConfigFilePath)) as EngineConfig,
                    path: engineConfigFilePath,
                };
            } catch (ex) {
                throw new Error(`failed evaluating config file: ${engineConfigFilePath}`);
            }
        }
        return { config: undefined, path: undefined };
    }

    protected getClosestEngineConfigPath() {
        return fs.promises.findClosestFile(this.basePath, ENGINE_CONFIG_FILE_NAME);
    }

    protected async importModules(requiredModules: string[]) {
        for (const requiredModule of requiredModules) {
            try {
                await import(require.resolve(requiredModule, { paths: [this.basePath] }));
            } catch (ex) {
                throw new Error(`failed requiring: ${requiredModule} ${(ex as Error)?.stack || String(ex)}`);
            }
        }
    }

    protected async readConfigs(): Promise<SetMultiMap<string, TopLevelConfig>> {
        const configurations = new SetMultiMap<string, TopLevelConfig>();
        const configsDirectoryPath = join(this.outputPath, 'configs');
        if (await fs.promises.exists(configsDirectoryPath)) {
            const folderEntities = await fs.promises.readdir(configsDirectoryPath, { withFileTypes: true });
            for (const entity of folderEntities) {
                if (entity.isDirectory()) {
                    const featureName = entity.name;
                    const featureConfigsDirectory = join(configsDirectoryPath, featureName);
                    const featureConfigsEntities = await fs.promises.readdir(featureConfigsDirectory, {
                        withFileTypes: true,
                    });
                    for (const possibleConfigFile of featureConfigsEntities) {
                        const fileExtention = extname(possibleConfigFile.name);
                        if (possibleConfigFile.isFile() && fileExtention === '.json') {
                            const configFileName = basename(possibleConfigFile.name, fileExtention);
                            const [configName] = configFileName.split('.');

                            const config = (await fs.promises.readJsonFile(
                                join(featureConfigsDirectory, possibleConfigFile.name)
                            )) as TopLevelConfig;

                            configurations.add(`${featureName}/${configName}`, config);
                        }
                    }
                }
            }
        }

        return configurations;
    }

    protected async writeManifest({
        features,
        featureName,
        configName,
        entryPoints,
    }: {
        features: Map<string, IFeatureDefinition>;
        featureName?: string;
        configName?: string;
        entryPoints: Record<string, Record<string, string>>;
    }) {
        const manifest: IBuildManifest = {
            features: Array.from(features.entries()).map(
                ([
                    featureName,
                    {
                        scopedName,
                        isRoot,
                        filePath,
                        envFilePaths,
                        contextFilePaths,
                        preloadFilePaths,
                        packageName,
                        dependencies,
                        exportedEnvs,
                        resolvedContexts,
                        directoryPath,
                    },
                ]) => [
                    featureName,
                    {
                        scopedName,
                        filePath: getFilePathInPackage(
                            fs,
                            packageName,
                            isRoot ? this.outputPath : directoryPath,
                            filePath,
                            isRoot
                        ),
                        envFilePaths: scopeFilePathsToPackage(
                            fs,
                            packageName,
                            isRoot ? this.outputPath : directoryPath,
                            envFilePaths,
                            isRoot
                        ),
                        contextFilePaths: scopeFilePathsToPackage(
                            fs,
                            packageName,
                            isRoot ? this.outputPath : directoryPath,
                            contextFilePaths,
                            isRoot
                        ),
                        preloadFilePaths: scopeFilePathsToPackage(
                            fs,
                            packageName,
                            isRoot ? this.outputPath : directoryPath,
                            preloadFilePaths,
                            isRoot
                        ),
                        dependencies: dependencies,
                        exportedEnvs: exportedEnvs,
                        resolvedContexts: resolvedContexts,
                        packageName,
                    } as IFeatureDefinition,
                ]
            ),
            defaultConfigName: configName,
            defaultFeatureName: featureName,
            entryPoints,
        };

        await fs.promises.ensureDirectory(this.outputPath);
        await fs.promises.writeFile(join(this.outputPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
    }

    protected createCompiler({
        features,
        featureName,
        configName,
        publicPath,
        mode,
        title,
        favicon,
        configurations,
        staticBuild,
        publicConfigsRoute,
        overrideConfig,
        singleFeature,
        isExternal,
        externalFeatures,
        useLocalExtenalFeaturesMapping: fetchFeatures,
        webpackConfigPath,
        environments,
        eagerEntrypoint,
    }: ICompilerOptions) {
        const { basePath, outputPath } = this;
        const baseConfigPath = webpackConfigPath
            ? fs.resolve(webpackConfigPath)
            : fs.findClosestFileSync(basePath, 'webpack.config.js');
        const baseConfig = (typeof baseConfigPath === 'string' ? require(baseConfigPath) : {}) as webpack.Configuration;

        const webpackConfigs = createWebpackConfigs({
            baseConfig,
            context: basePath,
            mode,
            outputPath,
            environments,
            features,
            featureName,
            configName,
            publicPath,
            title,
            favicon,
            configurations,
            staticBuild,
            publicConfigsRoute,
            overrideConfig,
            singleFeature,
            createWebpackConfig: isExternal ? createWebpackConfigForExteranlFeature : createWebpackConfig,
            externalFeatures,
            fetchFeatures,
            eagerEntrypoint,
        });

        const compiler = webpack(webpackConfigs);
        hookCompilerToConsole(compiler);
        return compiler;
    }

    protected analyzeFeatures() {
        const { basePath, featureDiscoveryRoot } = this;

        console.time(`Analyzing Features`);
        const packages = resolvePackages(basePath);
        const featuresAndConfigs = loadFeaturesFromPackages(packages, fs, featureDiscoveryRoot);
        console.timeEnd('Analyzing Features');
        return { ...featuresAndConfigs, packages };
    }

    protected createNodeEntries(
        features: Map<string, IFeatureDefinition>,
        featureName: string,
        nodeEnvs: Map<string, string[]>,
        featureOutPath: string
    ) {
        for (const feature of features.values()) {
            if (featureName === feature.scopedName) {
                for (const [envName, childEnvs] of nodeEnvs) {
                    const entryPath = join(this.outputPath, `${envName}.node.js`);
                    const entryCode = createExternalNodeEntrypoint({
                        ...feature,
                        childEnvs,
                        envName,
                        packageName: featureOutPath,
                    });
                    fs.writeFileSync(entryPath, entryCode);
                }
            }
        }
    }

    protected getFeatureEnvDefinitions(
        features: Map<string, IFeatureDefinition>,
        configurations: SetMultiMap<string, IConfigDefinition>
    ) {
        const rootFeatures = Array.from(features.values()).filter(({ isRoot }) => isRoot);
        const configNames = Array.from(configurations.keys());
        const featureEnvDefinitions: Record<
            string,
            { configurations: string[]; hasServerEnvironments: boolean; featureName: string }
        > = {};

        for (const { scopedName } of rootFeatures) {
            const [rootFeatureName] = scopedName.split('/');
            featureEnvDefinitions[scopedName] = {
                configurations: configNames.filter((name) => name.includes(rootFeatureName)),
                hasServerEnvironments: getEnvironmntsForFeature(scopedName, features, 'node').size > 0,
                featureName: scopedName,
            };
        }

        return featureEnvDefinitions;
    }

    protected filterByFeatureName(features: Map<string, IFeatureDefinition>, featureName: string) {
        const foundFeature = features.get(featureName);
        if (!foundFeature) {
            throw new Error(`cannot find feature: ${featureName}`);
        }
        const nonFoundDependencies: string[] = [];
        const filteredFeatures = [
            ...flattenTree(foundFeature, ({ dependencies }) =>
                dependencies.map((dependencyName) => {
                    const feature = features.get(dependencyName);
                    if (!feature) {
                        nonFoundDependencies.push(dependencyName);
                        return {} as IFeatureDefinition;
                    }
                    return feature;
                })
            ),
        ].map(({ scopedName }) => scopedName);
        if (nonFoundDependencies.length) {
            throw new Error(
                `The following features were not found during feature location: ${nonFoundDependencies.join(',')}`
            );
        }
        for (const [foundFeatureName] of features) {
            if (!filteredFeatures.includes(foundFeatureName)) {
                features.delete(foundFeatureName);
            }
        }
    }
}

function getFilePathInPackage(
    fs: IFileSystemSync,
    packageName: string,
    context: string,
    filePath: string,
    isRoot: boolean
) {
    const relativeFilePath = fs.relative(context, filePath);
    const relativeRequest = fs
        .join(fs.dirname(relativeFilePath), fs.basename(relativeFilePath, fs.extname(relativeFilePath)))
        .replace(/\\/g, '/');
    return isRoot
        ? relativeRequest.startsWith('.')
            ? relativeRequest
            : './' + relativeRequest
        : fs.posix.join(packageName, relativeRequest);
}

function scopeFilePathsToPackage(
    fs: IFileSystemSync,
    packageName: string,
    context: string,
    envFiles: Record<string, string>,
    isRoot: boolean
) {
    return Object.entries(envFiles).reduce<Record<string, string>>((acc, [envName, filePath]) => {
        acc[envName] = getFilePathInPackage(fs, packageName, context, filePath, isRoot);
        return acc;
    }, {});
}

const bundleStartMessage = ({ options: { target } }: webpack.Compiler) =>
    console.log(`Bundling ${target as string} using webpack...`);

function getEnvEntrypoints(
    envs: Iterable<string>,
    target: 'node' | 'web' | 'webworker' | 'electron-renderer',
    entryPoints: Record<string, Record<string, string>>,
    outDir: string
) {
    for (const envName of envs) {
        entryPoints[envName] = { ...entryPoints[envName], [target]: fs.posix.join(outDir, `${envName}.${target}.js`) };
    }
}

export function getExportedEnvironments(features: Map<string, IFeatureDefinition>): Set<IEnvironment> {
    const environments = new Set<IEnvironment>();
    for (const { exportedEnvs } of features.values()) {
        for (const exportedEnv of exportedEnvs) {
            environments.add(exportedEnv);
        }
    }
    return environments;
}

function hookCompilerToConsole(compiler: webpack.MultiCompiler): void {
    compiler.hooks.run.tap('engine-scripts', bundleStartMessage);
    compiler.hooks.watchRun.tap('engine-scripts', bundleStartMessage);

    compiler.hooks.done.tap('engine-scripts stats printing', ({ stats }) => {
        for (const childStats of stats) {
            if (childStats.hasErrors() || childStats.hasWarnings()) {
                console.log(childStats.toString('errors-warnings'));
            }
        }
        console.log('Done bundling.');
    });
}
