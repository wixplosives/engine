import fs from '@file-services/node';
import type { TopLevelConfig } from '@wixc3/engine-core';
import { loadTopLevelConfigs, importModules, type IStaticFeatureDefinition } from '@wixc3/engine-runtime-node';
import {
    Application,
    getExportedEnvironments,
    IApplicationOptions,
    IBuildCommandOptions as IEngineBuildCommandOptions,
} from '@wixc3/engine-scripts';
import { build as electronBuild, Configuration, FileSet, PublishOptions } from 'electron-builder';
import { dirname, posix, relative } from 'path';

import { getEngineConfig } from '../find-features';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: electronVersion } = require('electron/package.json') as { version: string };

export interface IBundleEngineArguments extends IApplicationOptions, IEngineBuildCommandOptions {
    /**
     * The feature you want to run
     */
    featureName: string;
    /**
     * The path which is where to search the feature at
     */
    basePath?: string;
    /**
     * The directory to which the bundled and transpiled code will be saved (relative to basePath)
     */
    outputPath?: string;
    /**
     * The name of the config you want your application to be built with
     */
    configName?: string;

    featureDiscoveryRoot?: string;
}
const possiblePublishValues = ['onTag', 'onTagOrDraft', 'always', 'never'];

export interface IBuildCommandOptions extends IBundleEngineArguments {
    /**
     * The name of the environment running in the electron-main process
     */
    envName: string;
    /**
     * The name of the electrion builder config file (relative to basePath)
     */
    electronBuilderConfigFileName?: string;
    /**
     * The directory to which the bundled and transpiled code will be saved (relative to basePath)
     */
    outDir?: string;
    /**
     * Electron builder targets
     */
    linux?: boolean;
    windows?: boolean;
    mac?: boolean;
    featureDiscoveryRoot?: string;

    /**
     * publish flag for electron builder
     */
    publish?: string;
}

const ELECTRON_ENTRY_FILE_NAME = 'electron-entry.js';

export async function build(options: IBuildCommandOptions): Promise<void> {
    const basePath = options.basePath ?? process.cwd();
    const { require: requiredModules, featureDiscoveryRoot: configFeatureDiscoveryRoot } =
        (await getEngineConfig(basePath)) || {};

    const {
        featureName,
        configName,
        envName,
        electronBuilderConfigFileName = 'electron-build.json',
        outDir = 'dist',
        linux,
        mac,
        windows,
        featureDiscoveryRoot = configFeatureDiscoveryRoot,
        publish,
    } = options;
    const outputPath = fs.join(basePath, outDir);
    if (!isPublishValid(publish)) {
        throw new Error(`publish value can be defined with the wollowing values: ${possiblePublishValues.join(',')}`);
    }

    if (requiredModules) {
        await importModules(basePath, requiredModules);
    }

    const config: TopLevelConfig = [];

    const { features, configurations } = await bundleEngineApp({
        ...options,
        basePath,
        outputPath,
        featureDiscoveryRoot,
    });

    if (configName) {
        config.push(...(await loadTopLevelConfigs(configName, configurations, envName)));
    }

    await createElectronEntryFile({
        outputPath: fs.join(outputPath, ELECTRON_ENTRY_FILE_NAME),
        featureName,
        envName,
        configName,
        config,
        features,
        outDir,
    });

    const configFullPath = fs.resolve(fs.join(basePath, electronBuilderConfigFileName));
    const { default: builderConfig } = (await import(configFullPath)) as { default: Configuration };

    const extraFiles: (string | FileSet)[] = [
        {
            from: dirname(require.resolve('@wixc3/engine-electron-host/package.json')),
            to: 'node_modules/@wixc3/engine-electron-host',
            // Avoid copying binary links of a package;
            // They contain relative links that will not work in built app, and also break Mac signing
            filter: ['!**/node_modules/.bin/**'],
        },
    ];

    const configFiles = builderConfig.extraFiles;
    if (configFiles) {
        if (Array.isArray(configFiles) && typeof configFiles !== 'string') {
            extraFiles.push(...configFiles);
        } else {
            extraFiles.push(configFiles);
        }
    }
    await electronBuild({
        config: {
            ...builderConfig,
            electronVersion,
            extraMetadata: {
                ...(builderConfig.extraMetadata as Record<string, string>),
                main: fs.join(outDir, ELECTRON_ENTRY_FILE_NAME),
            },
            extraFiles,
        },
        linux: linux ? [] : undefined,
        mac: mac ? [] : undefined,
        win: windows ? [] : undefined,
        publish,
    });
}
function isPublishValid(publish?: string | null): publish is PublishOptions['publish'] {
    return !publish || possiblePublishValues.includes(publish);
}

export interface CreateElectronEntryOptions {
    outputPath: string;
    featureName: string;
    envName: string;
    configName?: string;
    config: TopLevelConfig;
    features: Map<string, IStaticFeatureDefinition>;
    outDir: string;
}

/**
 * Create an entry for the built electron application
 * @param outputPath where to sabe the file to
 */
export function createElectronEntryFile({
    outputPath,
    featureName,
    envName,
    configName,
    config,
    features,
    outDir,
}: CreateElectronEntryOptions): Promise<void> {
    const currentFeature = features.get(featureName);
    if (!currentFeature) {
        throw new Error(`feature ${featureName} was not found. available features:
        ${[...features.keys()].join(', ')}`);
    }

    const env = [...getExportedEnvironments(features)].find(({ name }) => name === envName)?.env;

    if (!env) {
        throw new Error(`cannot create electron entry for ${envName}. No feature found exporting this environment`);
    }

    const mapAbsolutePathsToRequests = (path: string, packageName: string) => {
        const isThirdParty = packageName !== currentFeature.packageName;
        const absoluteBasePath = fs.dirname(
            isThirdParty ? require.resolve(posix.join(packageName, 'package.json')) : outputPath
        );
        // creating a posix kind of slashes, to match node requests syntax
        const relativeToPackageFileRequest = relative(absoluteBasePath, path).replace(/\\/gi, '/');

        return isThirdParty
            ? posix.join(packageName, relativeToPackageFileRequest)
            : `./${relativeToPackageFileRequest}`;
    };

    const scopedFeatures = [...features.entries()].map<[string, IStaticFeatureDefinition]>(
        ([featureName, featureDef]) => {
            const { packageName, contextFilePaths, preloadFilePaths, envFilePaths, filePath } = featureDef;
            return [
                featureName,
                {
                    ...featureDef,
                    contextFilePaths: Object.fromEntries(
                        Object.entries(contextFilePaths).map(([key, value]) => [
                            key,
                            mapAbsolutePathsToRequests(value, packageName),
                        ])
                    ),
                    envFilePaths: Object.fromEntries(
                        Object.entries(envFilePaths).map(([key, value]) => [
                            key,
                            mapAbsolutePathsToRequests(value, packageName),
                        ])
                    ),
                    filePath: mapAbsolutePathsToRequests(filePath, packageName),
                    preloadFilePaths: Object.fromEntries(
                        Object.entries(preloadFilePaths).map(([key, value]) => [
                            key,
                            mapAbsolutePathsToRequests(value, packageName),
                        ])
                    ),
                },
            ];
        }
    );

    return fs.promises.writeFile(
        outputPath,
        `process.env.NODE_ENV='production';
const { app } = require('electron');
const { join } = require('path')
const { runElectronEnv } = require('@wixc3/engine-electron-host');

const featureName = ${JSON.stringify(featureName)};
const configName = ${configName ? JSON.stringify(configName) : 'undefined'};

const config = ${JSON.stringify(config, null, 4)};
const features = new Map(${JSON.stringify(scopedFeatures, null, 4)});
const basePath = join(app.getAppPath(), ${JSON.stringify(outDir)});
const env = ${JSON.stringify(env)};

const resolvePath = (path) => require.resolve(path, { paths: [basePath] })

for(const featureDef of features.values()) {
    featureDef.filePath = resolvePath(featureDef.filePath);
    for(const [key, filePath] of Object.entries(featureDef.contextFilePaths)) {
        featureDef.contextFilePaths[key] = resolvePath(featureDef.contextFilePaths[key])
    }
    for(const [key, filePath] of Object.entries(featureDef.envFilePaths)) {
        featureDef.envFilePaths[key] = resolvePath(featureDef.envFilePaths[key])
    }
    for(const [key, filePath] of Object.entries(featureDef.preloadFilePaths)) {
        featureDef.preloadFilePaths[key] = resolvePath(featureDef.preloadFilePaths[key])
    }
}

runElectronEnv({
    basePath,
    featureName,
    outputPath: basePath,
    configName,
    config,
    features,
    env
}).catch(e => {
    console.error(e);
    process.exitCode = 1;
});
`
    );
}

/**
 * Bundles the renderer environments
 */
export async function bundleEngineApp(options: IBundleEngineArguments): ReturnType<Application['build']> {
    const app = new Application(options);

    return app.build({
        ...options,
        singleFeature: true,
    });
}
