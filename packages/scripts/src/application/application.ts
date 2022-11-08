import fs from '@file-services/node';
import { createDisposables } from '@wixc3/create-disposables';
import { flattenTree, TopLevelConfig } from '@wixc3/engine-core';
import { chain, defaults, SetMultiMap } from '@wixc3/common';
import { backSlash } from '@wixc3/fs-utils';
import {
    createIPC,
    ForkedProcess,
    IConfigDefinition,
    IExternalDefinition,
    IExternalFeatureNodeDescriptor,
    launchEngineHttpServer,
    NodeEnvironmentsManager,
    resolveEnvironments,
    RouteMiddleware,
} from '@wixc3/engine-runtime-node';
import express from 'express';
import webpack from 'webpack';
import { findFeatures } from '../analyze-feature';
import { ENGINE_CONFIG_FILE_NAME } from '../build-constants';
import {
    createCommunicationMiddleware,
    createConfigMiddleware,
    ensureTopLevelConfigMiddleware,
} from '../config-middleware';
import {
    createWebpackConfig,
    createWebpackConfigForExternalFeature,
    createWebpackConfigs,
} from '../create-webpack-configs';
import { generateFeature, pathToFeaturesDirectory } from '../feature-generator';
import type { EngineConfig, IFeatureDefinition } from '../types';
import { EXTERNAL_FEATURES_BASE_URI } from '../build-constants';
import { createExternalNodeEntrypoint } from '../create-entrypoint';
import {
    getExternalFeatureBasePath,
    getExternalFeaturesMetadata,
    getFilePathInPackage,
    scopeFilePathsToPackage,
    IResolvedEnvironment,
} from '../utils';
import type {
    IApplicationOptions,
    IBuildCommandOptions,
    WebpackMultiStats,
    IRunCommandOptions,
    IBuildManifest,
    IRunApplicationOptions,
    ICreateOptions,
    ICompilerOptions,
} from './types';
import { buildDefaults, DEFAULT_EXTERNAL_FEATURES_PATH } from './defaults';
import { addEnvEntrypoints, hookCompilerToConsole, toCompilerOptions, getResolvedEnvironments, compile } from './utils';

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
        const opts = defaults(options, buildDefaults);
        const { config: _config, path: configPath } = await this.getEngineConfig();
        const config: EngineConfig = defaults(_config, { externalFeatureDefinitions: [] as IExternalDefinition[] });

        if (opts.external && !opts.featureName) {
            throw new Error('You must specify a feature name when building a feature in external mode');
        }
        if (config.require) {
            await this.importModules(config.require);
        }
        const entryPoints: Record<string, Record<string, string>> = {};
        const analyzed = this.analyzeFeatures(opts.featureDiscoveryRoot ?? config.featureDiscoveryRoot);
        if (opts.singleFeature && opts.featureName) {
            this.filterByFeatureName(analyzed.features, opts.featureName);
        }

        const envs = getResolvedEnvironments(opts, analyzed.features);
        const { compiler } = this.createCompiler(toCompilerOptions(opts, analyzed, config, envs));
        const outDir = fs.basename(this.outputPath);

        const stats = await compile(compiler);

        const sourceRoot =
            opts.sourcesRoot ?? config.sourcesRoot ?? opts.featureDiscoveryRoot ?? config.featureDiscoveryRoot ?? '.';
        if (opts.external) {
            const feature = analyzed.features.get(opts.featureName!)!;
            const { nodeEnvs, electronRendererEnvs, webEnvs, workerEnvs } = envs;
            this.createNodeEntrypoint(feature, envs.nodeEnvs, sourceRoot);
            addEnvEntrypoints(nodeEnvs.keys(), 'node', entryPoints, outDir);
            addEnvEntrypoints(electronRendererEnvs.keys(), 'electron-renderer', entryPoints, outDir);
            addEnvEntrypoints(webEnvs.keys(), 'web', entryPoints, outDir);
            addEnvEntrypoints(workerEnvs.keys(), 'webworker', entryPoints, outDir);
        }

        const externalFeaturesBasePath = fs.resolve(
            opts.externalFeaturesBasePath ?? (config.externalFeaturesBasePath ? fs.dirname(configPath!) : this.basePath)
        );

        const externalFeatures = getExternalFeaturesMetadata(opts.externalFeatureDefinitions, externalFeaturesBasePath);

        if (opts.includeExternalFeatures && config.externalFeatureDefinitions.length) {
            externalFeatures.push(
                ...getExternalFeaturesMetadata(config.externalFeatureDefinitions, externalFeaturesBasePath)
            );
        }

        // creating external-features json either way
        this.writeExtFeaturesJson(opts, externalFeatures);

        const manifest = this.writeManifest(analyzed.features, opts, entryPoints, sourceRoot);

        /*  only if building this feature as a static build, 
            we want to create a folder that will match the external feature definition. 
            meaning that we will copy all external feature root folders into EXTERNAL_FEATURES_BASE_URI. 
            This is correct because the mapping for each feature inside the externalFeatures object, 
            will hold the following mapping for each web entry: 
            `${EXTERNAL_FEATURES_BASE_URI}/${externalFeaturePackageName}/${externalFeatureOutDir}/entry-file.js` */
        if (externalFeatures.length && opts.staticBuild) {
            await this.copyExternalFeatureFiles(opts, config, externalFeaturesBasePath);
        }

        await manifest;
        return { ...analyzed, stats, resolvedEnvironments: envs };
    }

    private writeExtFeaturesJson(
        opts: IBuildCommandOptions & {
            mode: string;
            external: boolean;
            staticBuild: boolean;
            staticExternalFeaturesFileName: string;
            externalFeatureDefinitions: never[];
        },
        externalFeatures: IExternalFeatureNodeDescriptor[]
    ) {
        fs.writeFileSync(
            fs.join(this.outputPath, backSlash(opts.staticExternalFeaturesFileName, 'none')),
            JSON.stringify(externalFeatures)
        );
    }

    private async copyExternalFeatureFiles(
        opts: IBuildCommandOptions & {
            mode: string;
            external: boolean;
            staticBuild: boolean;
            staticExternalFeaturesFileName: string;
            externalFeatureDefinitions: never[];
        },
        config: EngineConfig,
        resolvedExternalFeaturesBasePath: string
    ) {
        const externalFeaturesPath = fs.join(this.outputPath, EXTERNAL_FEATURES_BASE_URI);
        const copying = chain(opts.externalFeatureDefinitions as IExternalDefinition[])
            .concat(config.externalFeatureDefinitions)
            .map(({ packageName, packagePath }) => {
                const packageBaseDir = getExternalFeatureBasePath({
                    packageName,
                    basePath: resolvedExternalFeaturesBasePath,
                    packagePath,
                });
                return fs.promises.copyDirectory(packageBaseDir, fs.join(externalFeaturesPath, packageName));
            }).iterable;
        await Promise.all(copying);
    }

    public async run(runOptions: IRunCommandOptions = {}) {
        const {
            features: manifestFeatures,
            defaultConfigName,
            defaultFeatureName,
            externalsFilePath = DEFAULT_EXTERNAL_FEATURES_PATH,
        } = (await fs.promises.readJsonFile(join(this.outputPath, 'manifest.json'))) as IBuildManifest;

        const externalFeatures: IExternalFeatureNodeDescriptor[] = [];

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
            externalFeaturesPath: providedExternalFeaturesPath,
            serveExternalFeaturesPath: providedServeExternalFeaturesPath = true,
            externalFeatureDefinitions: providedExternalFeaturesDefinitions = [],
            socketServerOptions: runtimeSocketServerOptions,
        } = runOptions;
        const { config: engineConfig, path: configPath } = await this.getEngineConfig();

        const disposables = createDisposables();
        const configurations = await this.readConfigs();
        const socketServerOptions = { ...runtimeSocketServerOptions, ...engineConfig?.socketServerOptions };

        const config: TopLevelConfig = [...(Array.isArray(userConfig) ? userConfig : [])];

        const {
            externalFeatureDefinitions = [],
            externalFeaturesBasePath: baseExternalFeaturesPath,
            serveExternalFeaturesPath = providedServeExternalFeaturesPath,
            serveStatic = [],
            socketServerOptions: configSocketServerOptions,
            require: requiredPaths = [],
        } = engineConfig ?? {};

        const fixedExternalFeatureDefinitions = this.normalizeDefinitionsPackagePath(
            [...providedExternalFeaturesDefinitions, ...externalFeatureDefinitions],
            providedExternalFeaturesPath,
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

        // this will only be true when application is built statically (without node environments)
        if (externalsFilePath && fs.existsSync(join(this.outputPath, externalsFilePath))) {
            externalFeatures.push(
                ...(fs.readJsonFileSync(
                    join(this.outputPath, externalsFilePath),
                    'utf8'
                ) as IExternalFeatureNodeDescriptor[])
            );
        }

        const routeMiddlewares: RouteMiddleware[] = [];

        const resolvedExternalFeaturesPath = fs.resolve(
            providedExternalFeaturesPath ??
                baseExternalFeaturesPath ??
                (configPath ? fs.dirname(configPath) : this.basePath)
        );

        externalFeatures.push(
            ...getExternalFeaturesMetadata(fixedExternalFeatureDefinitions, resolvedExternalFeaturesPath)
        );

        // adding the route middlewares here because the launchHttpServer statically serves the 'staticDirPath'. but we want to add handlers to existing files there, so we want the custom middleware to be applied on an existing route
        if (serveStatic.length) {
            for (const { route, directoryPath } of serveStatic) {
                routeMiddlewares.push({ path: route, handlers: express.static(directoryPath) });
            }
        }

        routeMiddlewares.push({
            path: backSlash(externalsFilePath, 'heading'),
            handlers: (_, res: express.Response) => {
                res.json(externalFeatures);
            },
        });

        const { port, close, socketServer, app } = await launchEngineHttpServer({
            staticDirPath: this.outputPath,
            httpServerPort,
            socketServerOptions,
            routeMiddlewares,
        });
        disposables.add(close);

        // since the latest release was a patch, We need to be backward compatible with broken changes.
        // adding backward compatibility for previous engine versions.
        // todo: remove this on next major
        app.get('/external', (_, res) => {
            res.json(externalFeatures);
        });

        fixedExternalFeatureDefinitions.push(
            ...this.normalizeDefinitionsPackagePath(
                providedExternalFeaturesDefinitions,
                providedExternalFeaturesPath,
                baseExternalFeaturesPath,
                configPath
            )
        );

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
                externalFeatures,
                requiredPaths,
            },
            this.basePath,
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
            ])
        );
    }

    protected normalizeDefinitionsPackagePath(
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
        const { socketServer, close, port } = await launchEngineHttpServer({
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
                            const [configName] = configFileName.split('.') as [string];

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

    protected async writeManifest(
        features: Map<string, IFeatureDefinition>,
        opts: IBuildCommandOptions,
        entryPoints: Record<string, Record<string, string>>,
        pathToSources: string
    ) {
        const manifest: IBuildManifest = {
            features: Array.from(features.entries()).map(([featureName, featureDef]) =>
                this.generateReMappedFeature(featureDef, pathToSources, featureName)
            ),
            defaultConfigName: opts.configName,
            defaultFeatureName: opts.featureName,
            entryPoints,
            externalsFilePath: backSlash(opts.staticExternalFeaturesFileName!, 'heading'),
        };

        await fs.promises.ensureDirectory(this.outputPath);
        await fs.promises.writeFile(join(this.outputPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
    }

    private generateReMappedFeature(
        featureDef: IFeatureDefinition,
        pathToSources: string,
        featureName: string
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
        sourcesRoot: string
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
                    directoryPath
                );
            }

            for (const key of Object.keys(preloadFilePaths)) {
                preloadFilePaths[key] = this.remapPathToSourcesFolder(
                    sourcesRoot,
                    preloadFilePaths[key]!,
                    directoryPath
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
                envFilePaths
            ),
            contextFilePaths: scopeFilePathsToPackage(
                fs,
                packageName,
                context,
                isRoot && outputDirInBasePath,
                contextFilePaths
            ),
            preloadFilePaths: scopeFilePathsToPackage(
                fs,
                packageName,
                context,
                isRoot && outputDirInBasePath,
                preloadFilePaths
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
        externalFeaturesRoute,
        webpackConfigPath,
        environments,
        eagerEntrypoint,
        configLoaderModuleName,
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
            createWebpackConfig: isExternal ? createWebpackConfigForExternalFeature : createWebpackConfig,
            externalFeaturesRoute,
            eagerEntrypoint,
            configLoaderModuleName,
        });
        const compiler = webpack(webpackConfigs);
        hookCompilerToConsole(compiler);
        return { compiler };
    }

    protected analyzeFeatures(featureDiscoveryRoot = '.') {
        const { basePath } = this;

        console.time(`Analyzing Features`);
        // const packages = childPackagesFromContext(resolveDirectoryContext(basePath, fs));
        const featuresAndConfigs = findFeatures(basePath, fs, featureDiscoveryRoot);
        console.timeEnd('Analyzing Features');
        return featuresAndConfigs;
    }

    protected createNodeEntrypoint(
        feature: IFeatureDefinition,
        nodeEnvs: Map<string, IResolvedEnvironment>,
        pathToSources: string
    ) {
        for (const [envName, { env, childEnvs }] of nodeEnvs) {
            const entryPath = join(this.outputPath, `${envName}.node.js`);
            const [, reMappedFeature] = this.generateReMappedFeature({ ...feature }, pathToSources, feature.scopedName);
            const entryCode = createExternalNodeEntrypoint({
                ...reMappedFeature,
                childEnvs,
                env,
            });
            fs.writeFileSync(entryPath, entryCode);
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
            const [rootFeatureName] = scopedName.split('/') as [string];
            featureEnvDefinitions[scopedName] = {
                configurations: configNames.filter((name) => name.includes(rootFeatureName)),
                hasServerEnvironments: resolveEnvironments(scopedName, features, 'node').size > 0,
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
