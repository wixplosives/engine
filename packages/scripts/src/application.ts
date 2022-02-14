import { promisify } from 'util';
import express from 'express';
import rimrafCb from 'rimraf';
import webpack from 'webpack';
import { childPackagesFromContext, resolveDirectoryContext } from '@wixc3/resolve-directory-context';
import fs from '@file-services/node';
import type io from 'socket.io';
import { TopLevelConfig, SetMultiMap, flattenTree } from '@wixc3/engine-core';
import { createDisposables } from '@wixc3/create-disposables';

import { loadFeaturesFromPackages } from './analyze-feature';
import { ENGINE_CONFIG_FILE_NAME } from './build-constants';
import {
    createConfigMiddleware,
    createCommunicationMiddleware,
    ensureTopLevelConfigMiddleware,
} from './config-middleware';
import {
    createWebpackConfig,
    createWebpackConfigForExternalFeature,
    createWebpackConfigs,
} from './create-webpack-configs';
import type { EngineConfig, IFeatureDefinition, IFeatureTarget } from './types';
import { generateFeature, pathToFeaturesDirectory } from './feature-generator';
import {
    launchEngineHttpServer,
    RouteMiddleware,
    resolveEnvironments,
    ForkedProcess,
    LaunchEnvironmentMode,
    NodeEnvironmentsManager,
    createIPC,
    IConfigDefinition,
    IEnvironment,
    IExternalDefinition,
    IExternalFeatureNodeDescriptor,
    TopLevelConfigProvider,
} from '@wixc3/engine-runtime-node';

import {
    getExternalFeatureBasePath,
    getExternalFeaturesMetadata,
    getFilePathInPackage,
    scopeFilePathsToPackage,
} from './utils';
import { createExternalNodeEntrypoint } from './create-entrypoint';
import { EXTERNAL_FEATURES_BASE_URI } from './build-constants';

import { getResolvedEnvironments } from './utils/environments';

const rimraf = promisify(rimrafCb);
const { basename, extname, join } = fs;

const builtinTemplatesPath = fs.join(__dirname, '../templates');

export interface IRunFeatureOptions extends IFeatureTarget {
    featureName: string;
}

export interface IRunApplicationOptions extends IFeatureTarget {
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
    featureDiscoveryRoot?: string;
    external?: boolean;
    staticBuild?: boolean;
    externalFeaturesFilePath?: string;
    sourcesRoot?: string;
    staticExternalFeaturesFileName?: string;
    includeExternalFeatures?: boolean;
    eagerEntrypoint?: boolean;
    favicon?: string;
    externalFeaturesBasePath?: string;
    externalFeatureDefinitions?: IExternalDefinition[];
}

// inlined to stay type-compatible with @types/webpack
export interface WebpackMultiStats {
    hasWarnings(): boolean;
    hasErrors(): boolean;
    toString(mode?: string): string;
    stats: webpack.Stats[];
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
    externalsFilePath?: string;
}

export interface ICreateOptions {
    featureName?: string;
    templatesDir?: string;
    featuresDir?: string;
}

export interface IApplicationOptions {
    basePath?: string;
    outputPath?: string;
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
    externalFeaturesRoute: string;
    webpackConfigPath?: string;
    environments: Pick<ReturnType<typeof getResolvedEnvironments>, 'electronRendererEnvs' | 'workerEnvs' | 'webEnvs'>;
    eagerEntrypoint?: boolean;
}

const DEFAULT_EXTERNAL_FEATURES_PATH = 'external-features.json';

export class Application {
    public outputPath: string;
    protected basePath: string;

    constructor({ basePath = process.cwd(), outputPath = fs.join(basePath, 'dist-app') }: IApplicationOptions) {
        this.basePath = basePath;
        this.outputPath = outputPath;
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
        staticExternalFeaturesFileName = DEFAULT_EXTERNAL_FEATURES_PATH,
        webpackConfigPath,
        includeExternalFeatures,
        sourcesRoot: providedSourcesRoot,
        eagerEntrypoint,
        externalFeaturesBasePath,
        externalFeatureDefinitions: providedExternalFeatureDefinitions = [],
        featureDiscoveryRoot: providedFeatureDiscoveryRoot,
    }: IBuildCommandOptions = {}): Promise<{
        stats: WebpackMultiStats;
        features: Map<string, IFeatureDefinition>;
        configurations: SetMultiMap<string, IConfigDefinition>;
        resolvedEnvironments: ReturnType<typeof getResolvedEnvironments>;
    }> {
        const { config, path: configPath } = await this.getEngineConfig();
        const {
            require,
            externalFeatureDefinitions: configExternalFeatureDefinitions = [],
            externalFeaturesBasePath: configExternalFeaturesBasePath,
            sourcesRoot: configSourcesRoot,
            favicon: configFavicon,
            featureDiscoveryRoot,
        } = config ?? {};
        if (require) {
            await this.importModules(require);
        }
        const entryPoints: Record<string, Record<string, string>> = {};

        if (external && !featureName) {
            throw new Error('You must specify a feature name when building a feature in external mode');
        }

        const { features, configurations } = this.analyzeFeatures(providedFeatureDiscoveryRoot ?? featureDiscoveryRoot);
        if (singleFeature && featureName) {
            this.filterByFeatureName(features, featureName);
        }

        const resolvedEnvironments = getResolvedEnvironments({
            featureName,
            features,
            filterContexts: singleFeature,
            environments: [...getExportedEnvironments(features)],
            findAllEnviromnents: external,
        });

        const externalsFilePath = staticExternalFeaturesFileName.startsWith('/')
            ? staticExternalFeaturesFileName
            : `/${staticExternalFeaturesFileName}`;

        const { compiler } = this.createCompiler({
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
            // whether should fetch at runtime for the external features metadata
            externalFeaturesRoute: staticExternalFeaturesFileName,
            webpackConfigPath,
            environments: resolvedEnvironments,
            eagerEntrypoint,
        });
        const outDir = fs.basename(this.outputPath);

        const stats = await new Promise<webpack.MultiStats>((resolve, reject) =>
            compiler.run((e, s) => {
                if (e) {
                    reject(e);
                } else if (s!.hasErrors()) {
                    reject(new Error(s!.toString('errors-warnings')));
                } else {
                    resolve(s!);
                }
            })
        );

        const sourceRoot =
            providedSourcesRoot ?? configSourcesRoot ?? providedFeatureDiscoveryRoot ?? featureDiscoveryRoot ?? '.';
        if (external) {
            const feature = features.get(featureName!)!;
            const { nodeEnvs, electronRendererEnvs, webEnvs, workerEnvs } = resolvedEnvironments;
            this.createNodeEntry(feature, resolvedEnvironments.nodeEnvs, sourceRoot);
            getEnvEntrypoints(nodeEnvs.keys(), 'node', entryPoints, outDir);
            getEnvEntrypoints(electronRendererEnvs.keys(), 'electron-renderer', entryPoints, outDir);
            getEnvEntrypoints(webEnvs.keys(), 'web', entryPoints, outDir);
            getEnvEntrypoints(workerEnvs.keys(), 'webworker', entryPoints, outDir);
        }

        const resolvedExternalFeaturesBasePath = fs.resolve(
            externalFeaturesBasePath ?? (configExternalFeaturesBasePath ? fs.dirname(configPath!) : this.basePath)
        );

        const externalFeatures = getExternalFeaturesMetadata(
            providedExternalFeatureDefinitions,
            resolvedExternalFeaturesBasePath
        );

        if (includeExternalFeatures && configExternalFeatureDefinitions.length) {
            externalFeatures.push(
                ...getExternalFeaturesMetadata(configExternalFeatureDefinitions, resolvedExternalFeaturesBasePath)
            );
        }

        // cretaing external-features json either way
        fs.writeFileSync(
            fs.join(
                this.outputPath,
                staticExternalFeaturesFileName.startsWith('/')
                    ? staticExternalFeaturesFileName.slice(1)
                    : staticExternalFeaturesFileName
            ),
            JSON.stringify(externalFeatures)
        );

        // only if building this feature as a static build, we want to create a folder that will match the external feature definition. meaning that we will copy all external feature root folders into EXTERNAL_FEATURES_BASE_URI. This is correct beceuase the mapping for each feature inside the externalFeatures onkect, will hold the following mapping for each web entry: `${EXTERNAL_FEATURES_BASE_URI}/${externalFeaturePackageName}/${externalFeatureOutDir}/entry-file.js`
        if (externalFeatures.length && staticBuild) {
            const externalFeaturesPath = fs.join(this.outputPath, EXTERNAL_FEATURES_BASE_URI);
            for (const { packageName, packagePath } of [
                ...providedExternalFeatureDefinitions,
                ...configExternalFeatureDefinitions,
            ]) {
                const packageBaseDir = getExternalFeatureBasePath({
                    packageName,
                    basePath: resolvedExternalFeaturesBasePath,
                    packagePath,
                });
                await fs.promises.copyDirectory(packageBaseDir, fs.join(externalFeaturesPath, packageName));
            }
        }

        await this.writeManifest({
            features,
            featureName,
            configName,
            entryPoints,
            externalsFilePath,
            pathToSources: sourceRoot,
        });

        return { stats, features, configurations, resolvedEnvironments };
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
            externalFeaturesPath: providedExternalFeatuersPath,
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
            providedExternalFeatuersPath ??
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
            path: externalsFilePath.startsWith('/') ? externalsFilePath : `/${externalsFilePath}`,
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
                providedExternalFeatuersPath,
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

    protected async writeManifest({
        features,
        featureName,
        configName,
        entryPoints,
        externalsFilePath,
        pathToSources,
    }: {
        features: Map<string, IFeatureDefinition>;
        featureName?: string;
        configName?: string;
        externalsFilePath: string;
        entryPoints: Record<string, Record<string, string>>;
        pathToSources: string;
    }) {
        const manifest: IBuildManifest = {
            features: Array.from(features.entries()).map(([featureName, featureDef]) =>
                this.generateReMappedFeature(featureDef, pathToSources, featureName)
            ),
            defaultConfigName: configName,
            defaultFeatureName: featureName,
            entryPoints,
            externalsFilePath,
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
        });
        const compiler = webpack(webpackConfigs);
        hookCompilerToConsole(compiler);
        return {
            compiler,
        };
    }

    protected analyzeFeatures(featureDiscoveryRoot = '.') {
        const { basePath } = this;

        console.time(`Analyzing Features`);
        const packages = childPackagesFromContext(resolveDirectoryContext(basePath, fs));
        const featuresAndConfigs = loadFeaturesFromPackages(packages, fs, featureDiscoveryRoot);
        console.timeEnd('Analyzing Features');
        return { ...featuresAndConfigs, packages };
    }

    protected createNodeEntry(feature: IFeatureDefinition, nodeEnvs: Map<string, string[]>, pathToSources: string) {
        for (const [envName, childEnvs] of nodeEnvs) {
            const entryPath = join(this.outputPath, `${envName}.node.js`);
            const [, reMappedFeature] = this.generateReMappedFeature({ ...feature }, pathToSources, feature.scopedName);
            const entryCode = createExternalNodeEntrypoint({
                ...reMappedFeature,
                childEnvs,
                envName,
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
    });
}
