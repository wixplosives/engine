import { nodeFs as fs } from '@file-services/node';
import { defaults } from '@wixc3/common';
import { type TopLevelConfig } from '@wixc3/engine-core';
import {
    launchEngineHttpServer,
    NodeEnvironmentsManager,
    resolveEnvironments,
    type IConfigDefinition,
    type RouteMiddleware,
} from '@wixc3/engine-runtime-node';
import { createDisposables, SetMultiMap } from '@wixc3/patterns';
import express from 'express';
import webpack from 'webpack';
import { analyzeFeatures } from '../analyze-feature';
import { ENGINE_CONFIG_FILE_NAME } from '../build-constants';
import {
    createCommunicationMiddleware,
    createConfigMiddleware,
    ensureTopLevelConfigMiddleware,
} from '../config-middleware';
import { createWebpackConfig, createWebpackConfigs } from '../create-webpack-configs';
import { generateFeature, pathToFeaturesDirectory } from '../feature-generator';
import type { EngineConfig, IFeatureDefinition } from '../types';
import { getFilePathInPackage, getResolvedEnvironments, scopeFilePathsToPackage } from '../utils';
import { buildDefaults } from './defaults';
import type {
    IApplicationOptions,
    IBuildCommandOptions,
    IBuildManifest,
    ICompilerOptions,
    ICreateOptions,
    IRunApplicationOptions,
    WebpackMultiStats,
} from './types';
import { compile, hookCompilerToConsole, toCompilerOptions } from './utils';

const { basename, extname, join } = fs;

const builtinTemplatesPath = fs.join(__dirname, '../templates');

export class Application {
    public outputPath: string;
    protected basePath: string;

    constructor({ basePath = process.cwd(), outputPath = fs.join(basePath, 'dist-app') }: IApplicationOptions) {
        this.basePath = basePath;
        this.outputPath = outputPath;
    }

    public async clean() {
        await fs.promises.rm(this.outputPath, { force: true, recursive: true });
    }

    public async build(options: IBuildCommandOptions = {}): Promise<{
        stats: WebpackMultiStats;
        features: Map<string, IFeatureDefinition>;
        configurations: SetMultiMap<string, IConfigDefinition>;
        resolvedEnvironments: ReturnType<typeof getResolvedEnvironments>;
    }> {
        const buildOptions = defaults(options, buildDefaults);
        const { config: _config } = await this.getEngineConfig(
            buildOptions.engineConfigPath ? fs.resolve(this.basePath, buildOptions.engineConfigPath) : undefined,
        );
        const config = defaults(_config ?? {}, buildDefaults);

        if (config.require) await this.importModules(config.require);

        const entryPoints: Record<string, Record<string, string>> = {};
        const analyzed = await analyzeFeatures(
            fs,
            this.basePath,
            buildOptions.featureDiscoveryRoot ?? config.featureDiscoveryRoot,
            buildOptions.singleFeature ? buildOptions.featureName : undefined,
            config.extensions,
            config.buildConditions,
        );

        const envs = getResolvedEnvironments({
            featureName: buildOptions.featureName,
            features: analyzed.features,
            filterContexts: buildOptions.singleFeature,
        });

        const { compiler } = await this.createCompiler(toCompilerOptions(buildOptions, analyzed, config, envs));
        const stats = await compile(compiler);
        const sourceRoot = buildOptions.sourcesRoot ?? buildOptions.featureDiscoveryRoot ?? '.';
        const manifest = this.writeManifest(analyzed.features, buildOptions, entryPoints, sourceRoot);

        await manifest;
        return { ...analyzed, stats, resolvedEnvironments: envs };
    }

    public async run(runOptions: IRunApplicationOptions = {}) {
        const {
            features: manifestFeatures,
            defaultConfigName,
            defaultFeatureName,
        } = (await fs.promises.readJsonFile(join(this.outputPath, 'manifest.json'))) as IBuildManifest;

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
            socketServerOptions: runtimeSocketServerOptions,
        } = runOptions;
        const { config: engineConfig } = await this.getEngineConfig();

        const disposables = createDisposables();
        const configurations = await this.readConfigs();
        const socketServerOptions = { ...runtimeSocketServerOptions, ...engineConfig?.socketServerOptions };

        const config: TopLevelConfig = [...(Array.isArray(userConfig) ? userConfig : [])];

        const {
            serveStatic = [],
            socketServerOptions: configSocketServerOptions,
            require: requiredPaths = [],
        } = engineConfig ?? {};

        const routeMiddlewares: RouteMiddleware[] = [];

        // adding the route middlewares here because the launchHttpServer statically serves the 'staticDirPath'. but we want to add handlers to existing files there, so we want the custom middleware to be applied on an existing route
        if (serveStatic.length) {
            for (const { route, directoryPath } of serveStatic) {
                routeMiddlewares.push({ path: route, handlers: express.static(directoryPath) });
            }
        }

        const { port, close, socketServer, app } = await launchEngineHttpServer({
            staticDirPath: this.outputPath,
            httpServerPort,
            socketServerOptions,
            routeMiddlewares,
        });
        disposables.add(close, {
            name: 'EngineHttpServer',
            timeout: 10_000,
        });

        const nodeEnvironmentManager = new NodeEnvironmentsManager(
            socketServer,
            {
                features: this.remapManifestFeaturePaths(manifestFeatures),
                port,
                bundlePath: this.outputPath,
                defaultRuntimeOptions,
                inspect,
                overrideConfig: config,
                configurations,
                requiredPaths,
            },
            this.basePath,
            { ...socketServerOptions, ...configSocketServerOptions },
        );
        disposables.add(() => nodeEnvironmentManager.closeAll(), {
            name: 'NodeEnvironmentManager',
            timeout: 10_000,
        });

        if (publicConfigsRoute) {
            app.use(`/${publicConfigsRoute}`, [
                ensureTopLevelConfigMiddleware,
                createCommunicationMiddleware(nodeEnvironmentManager, publicPath),
                createConfigMiddleware(config),
            ]);
        }

        if (autoLaunch && featureName) {
            await nodeEnvironmentManager.runServerEnvironments({
                featureName,
                configName,
                mode: nodeEnvironmentsMode ?? engineConfig?.nodeEnvironmentsMode,
            });
        }

        return {
            port,
            router: app,
            nodeEnvironmentManager,
            close: disposables.dispose,
        };
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

    private resolveManifestPaths(envFilePaths: Record<string, string> = {}): Record<string, string> {
        return Object.fromEntries(
            Object.entries(envFilePaths).map<[string, string]>(([envName, filePath]) => [
                envName,
                require.resolve(filePath, { paths: [this.outputPath] }),
            ]),
        );
    }

    protected async getEngineConfig(customConfigFilePath?: string): Promise<{ config?: EngineConfig; path?: string }> {
        const engineConfigFilePath = customConfigFilePath ?? (await this.getClosestEngineConfigPath());
        if (engineConfigFilePath) {
            try {
                return {
                    config: ((await import(engineConfigFilePath)) as { default: EngineConfig }).default,
                    path: engineConfigFilePath,
                };
            } catch (ex) {
                throw new Error(`failed importing config file: ${engineConfigFilePath}`, { cause: ex });
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
                throw new Error(`failed importing: ${requiredModule}`, { cause: ex });
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
                            const [configName] = configFileName.split('.') as [string];

                            const config = (await fs.promises.readJsonFile(
                                join(featureConfigsDirectory, possibleConfigFile.name),
                            )) as TopLevelConfig;

                            configurations.add(`${featureName}/${configName}`, config);
                        }
                    }
                }
            }
        }

        return configurations;
    }

    protected async writeManifest(
        features: Map<string, IFeatureDefinition>,
        opts: IBuildCommandOptions,
        entryPoints: Record<string, Record<string, string>>,
        pathToSources: string,
    ) {
        const manifest: IBuildManifest = {
            features: Array.from(features.entries()).map(([featureName, featureDef]) =>
                this.generateReMappedFeature(featureDef, pathToSources, featureName),
            ),
            defaultConfigName: opts.configName,
            defaultFeatureName: opts.featureName,
            entryPoints,
        };

        await fs.promises.ensureDirectory(this.outputPath);
        await fs.promises.writeFile(join(this.outputPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
    }

    private generateReMappedFeature(
        featureDef: IFeatureDefinition,
        pathToSources: string,
        featureName: string,
    ): [featureName: string, featureDefinition: IFeatureDefinition] {
        const sourcesRoot = fs.resolve(featureDef.directoryPath, pathToSources);
        return [
            featureName,
            {
                ...{ ...featureDef },
                ...this.mapFeatureFiles(featureDef, sourcesRoot),
            } as IFeatureDefinition,
        ];
    }

    private mapFeatureFiles(
        {
            envFilePaths,
            contextFilePaths,
            filePath,
            packageName,
            preloadFilePaths,
            isRoot,
            directoryPath,
        }: IFeatureDefinition,
        sourcesRoot: string,
    ) {
        if (isRoot) {
            // mapping all paths to the sources folder
            filePath = this.remapPathToSourcesFolder(sourcesRoot, filePath, directoryPath);
            for (const key of Object.keys(envFilePaths)) {
                envFilePaths[key] = this.remapPathToSourcesFolder(sourcesRoot, envFilePaths[key]!, directoryPath);
            }

            for (const key of Object.keys(contextFilePaths)) {
                contextFilePaths[key] = this.remapPathToSourcesFolder(
                    sourcesRoot,
                    contextFilePaths[key]!,
                    directoryPath,
                );
            }

            for (const key of Object.keys(preloadFilePaths)) {
                preloadFilePaths[key] = this.remapPathToSourcesFolder(
                    sourcesRoot,
                    preloadFilePaths[key]!,
                    directoryPath,
                );
            }
        }
        const outputDirInBasePath = this.outputPath.startsWith(this.basePath);
        const context = isRoot && outputDirInBasePath ? this.outputPath : directoryPath;

        return {
            filePath: getFilePathInPackage(fs, packageName, context, filePath, isRoot && outputDirInBasePath),
            envFilePaths: scopeFilePathsToPackage(
                fs,
                packageName,
                context,
                isRoot && outputDirInBasePath,
                envFilePaths,
            ),
            contextFilePaths: scopeFilePathsToPackage(
                fs,
                packageName,
                context,
                isRoot && outputDirInBasePath,
                contextFilePaths,
            ),
            preloadFilePaths: scopeFilePathsToPackage(
                fs,
                packageName,
                context,
                isRoot && outputDirInBasePath,
                preloadFilePaths,
            ),
        };
    }

    private remapPathToSourcesFolder(sourcesRoot: string, filePath: string, packageBasePath: string): string {
        if (filePath.includes(sourcesRoot)) {
            return filePath;
        }
        const relativeRequestToFile = fs.relative(packageBasePath, filePath);
        return fs.join(sourcesRoot, relativeRequestToFile);
    }

    protected async createCompiler({
        features,
        featureName,
        configName,
        publicPath,
        publicPathVariableName,
        mode,
        title,
        favicon,
        configurations,
        staticBuild,
        publicConfigsRoute,
        overrideConfig,
        singleFeature,
        webpackConfigPath,
        environments,
        eagerEntrypoint,
        configLoaderModuleName,
    }: ICompilerOptions) {
        const { basePath, outputPath } = this;
        const baseConfigPath = webpackConfigPath
            ? fs.resolve(webpackConfigPath)
            : fs.findClosestFileSync(basePath, 'webpack.config.js');
        const baseConfig =
            typeof baseConfigPath === 'string'
                ? ((await import(baseConfigPath)) as { default: webpack.Configuration }).default
                : {};
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
            publicPathVariableName,
            title,
            favicon,
            configurations,
            staticBuild,
            publicConfigsRoute,
            overrideConfig,
            singleFeature,
            createWebpackConfig,
            eagerEntrypoint,
            configLoaderModuleName,
        });
        const compiler = webpack(webpackConfigs);
        hookCompilerToConsole(compiler);
        return { compiler };
    }

    public getFeatureEnvDefinitions(
        features: Map<string, IFeatureDefinition>,
        configurations: SetMultiMap<string, IConfigDefinition>,
    ) {
        const rootFeatures = Array.from(features.values()).filter(({ isRoot }) => isRoot);
        const configNames = Array.from(configurations.keys());
        const featureEnvDefinitions: Record<
            string,
            { configurations: string[]; hasServerEnvironments: boolean; featureName: string }
        > = {};

        for (const { scopedName } of rootFeatures) {
            const [rootFeatureName] = scopedName.split('/') as [string];
            featureEnvDefinitions[scopedName] = {
                configurations: configNames.filter((name) => name.includes(rootFeatureName)),
                hasServerEnvironments: resolveEnvironments(scopedName, features, 'node').size > 0,
                featureName: scopedName,
            };
        }

        return featureEnvDefinitions;
    }
}
