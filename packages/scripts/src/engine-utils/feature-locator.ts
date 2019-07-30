import { IFileSystem } from '@file-services/types';
import {
    AsyncEnvironment,
    Environment,
    EnvironmentContext,
    EnvironmentTypes,
    Feature,
    MultiEndPointAsyncEnvironment,
    SingleEndPointAsyncEnvironment,
    SomeFeature
} from '@wixc3/engine-core';
import {
    ENTRY_PREFIX_FILENAME,
    isContextFile,
    isEnvFile,
    isFeatureFile,
    parseConfigFileName,
    parseContextFileName,
    parseEnvFileName,
    parseFeatureFileName
} from '../build-constants';
import {
    EngineEnvironmentEntry,
    EvaluatedFeature,
    FeatureMapping,
    JSRuntime,
    SingleFeatureWithConfig,
    SymbolList
} from '../types';
import { evaluateModule } from '../utils/evaluate-module';
import { instanceOf } from '../utils/instance-of';
import { findEngineFiles, IFeatureEntityFiles } from './find-engine-files';
import { walkChildrenTreeByDepth } from './walk-children-tree';

const rootFeatureLocations = ['', 'src', 'feature'];

export class FeatureLocator {
    constructor(private basePath: string, private fs: IFileSystem) {}

    /**
     * finds all features at innerPath folder and one sub folder deep
     */
    public findFeaturesInFolder(innerPath: string = '') {
        const { fs, basePath } = this;
        const featureFiles: IFeatureEntityFiles[] = [];

        const directoryPath = fs.resolve(basePath, innerPath);
        if (fs.directoryExistsSync(directoryPath)) {
            featureFiles.push(findEngineFiles({ directoryPath, fs }));

            for (const itemName of fs.readdirSync(directoryPath)) {
                const innerPathItem = fs.join(directoryPath, itemName);
                if (fs.directoryExistsSync(innerPathItem)) {
                    featureFiles.push(findEngineFiles({ fs, directoryPath: innerPathItem }));
                }
            }
        }
        return featureFiles;
    }

    public createFeatureMapping(
        buildSingleFeature: boolean = false,
        featureName?: string,
        configName?: string
    ): FeatureMapping {
        const rootFeatureFiles = this.findRootFeatureFiles();

        const fixturesFiles = this.findFeaturesInFolder('fixtures');
        const { basename } = this.fs;
        const rootFeatureName = parseFeatureFileName(basename(rootFeatureFiles.features[0]));

        if (buildSingleFeature) {
            return this.createFeatureMappingForSingleFeatureAndConfig(
                rootFeatureName,
                rootFeatureFiles,
                fixturesFiles,
                featureName,
                configName
            );
        }
        const mapping = this.getMappingForFeatureFiles(
            [rootFeatureFiles, ...fixturesFiles],
            rootFeatureName,
            rootFeatureFiles
        );

        // TODO: check if can be removed
        const bootstrapFeatures: string[] = [];
        for (const { featureFilePath } of Object.values(mapping)) {
            bootstrapFeatures.push(featureFilePath);
        }

        return {
            mapping,
            bootstrapFeatures,
            rootFeatureName
        };
    }

    public createFeatureMappingForSingleFeatureAndConfig(
        rootFeatureName: string,
        rootFeatureFilesEntry: IFeatureEntityFiles,
        fixtureFileEntities: IFeatureEntityFiles[],
        featureName?: string,
        configName?: string
    ): FeatureMapping {
        if (!configName) {
            throw new Error('Configuration name was not provided');
        }

        const { basename } = this.fs;
        const currentFeatureName = featureName || rootFeatureName;
        const currentFeatureFile =
            currentFeatureName === rootFeatureName
                ? rootFeatureFilesEntry
                : fixtureFileEntities.find(
                      fileEntry =>
                          !!fileEntry.features[0] &&
                          parseFeatureFileName(basename(fileEntry.features[0])) === currentFeatureName
                  );

        if (!currentFeatureFile) {
            throw new Error(`No such feature file ${featureName}`);
        }
        const mapping = this.getMappingForFeatureFiles([currentFeatureFile], currentFeatureName, rootFeatureFilesEntry);

        const currentConfigurationForFeature = mapping[currentFeatureName].configurations[configName];
        if (!currentConfigurationForFeature) {
            throw new Error(`Configuration ${configName} doesn't exists on ${featureName}`);
        }

        mapping[currentFeatureName].configurations = {
            [configName]: currentConfigurationForFeature
        };

        const bootstrapFeatures = [mapping[Object.keys(mapping)[0]].featureFilePath];
        return {
            mapping,
            bootstrapFeatures,
            rootFeatureName: currentFeatureName
        };
    }

    public getMappingForFeatureFiles(
        featureFileEntities: IFeatureEntityFiles[],
        rootFeatureName: string,
        rootFeatureFilesEntry: IFeatureEntityFiles
    ): { [featureName: string]: SingleFeatureWithConfig } {
        return featureFileEntities.reduce<FeatureMapping['mapping']>((acc, fixtureFiles) => {
            const { basename } = this.fs;
            const features =
                fixtureFiles.features.length === 0 ? [rootFeatureFilesEntry.features[0]] : fixtureFiles.features;
            for (const featureFilePath of features) {
                const featureName = parseFeatureFileName(basename(featureFilePath));
                if (acc[featureName]) {
                    if (featureName === rootFeatureName) {
                        this.addToConfigurationsMapping(acc[featureName].configurations, fixtureFiles.configurations);
                    } else {
                        throw new Error(
                            `Duplicate feature name ${featureName} at ["${featureFilePath}", "${acc[featureName].featureFilePath}"]`
                        );
                    }
                } else {
                    const configurations = this.addToConfigurationsMapping({}, fixtureFiles.configurations);
                    if (Object.keys(configurations).length > 0) {
                        acc[featureName] = {
                            featureFilePath,
                            configurations,
                            context: {}
                        };
                    }
                }
            }
            return acc;
        }, {});
    }

    /**
     * Find all environment files for a given environment.
     *
     * @param environmentName name of the environment
     * @param features set of feature file paths
     * @param results set of environment specific .env. files
     */
    public findEnvironmentSetupFiles(
        environmentName: string,
        features: Set<string>,
        results = new Set<string>()
    ): Set<string> {
        const { fs } = this;
        for (const featureFilePath of features) {
            const featureDirectoryPath = fs.dirname(featureFilePath);

            for (const fileName of fs.readdirSync(featureDirectoryPath)) {
                if (isEnvFile(fileName)) {
                    const { envName } = parseEnvFileName(fileName);
                    if (envName === environmentName) {
                        results.add(fs.join(featureDirectoryPath, fileName));
                    }
                }
            }
        }
        return results;
    }

    public findContextSetupFiles(
        baseEnvironmentName: string,
        childEnvironmentName: string,
        features: Set<string>,
        results = new Set<string>()
    ) {
        const { dirname, join, readdirSync } = this.fs;
        for (const featureFilePath of features) {
            const featureDirectoryPath = dirname(featureFilePath);

            for (const fileName of readdirSync(featureDirectoryPath)) {
                if (isContextFile(fileName)) {
                    const { envName, childEnvName } = parseContextFileName(fileName);
                    if (`${envName}.${childEnvName}` === `${baseEnvironmentName}.${childEnvironmentName}`) {
                        results.add(join(featureDirectoryPath, fileName));
                    }
                }
            }
        }
        return results;
    }

    /**
     * Locate .feature files from list of modules (using nodejs module system) and collect runtime entities
     * - filename is full path like in nodejs modules
     *
     * @param modulesPaths list of modules files to collect features from
     * @param basePath base path to resolve from
     */
    public locateFeatureEntities(
        modulesPaths: string[],
        cache: Map<string, EvaluatedFeature> = new Map()
    ): EvaluatedFeature[] {
        const { basename } = this.fs;
        const locatorModule = evaluateModule(modulesPaths);
        const features = walkChildrenTreeByDepth(
            locatorModule,
            ({ filename }) => isFeatureFile(basename(filename)),
            ({ filename, exports }) => {
                return (cache.has(filename)
                    ? cache.get(filename)
                    : cache.set(filename, collectEngineEntities(filename, exports)).get(filename))!;
            }
        );
        return [...features];
    }

    public addContextsToFeatureMapping(evaluatedFeatures: EvaluatedFeature[], featureMapping: FeatureMapping) {
        for (const featureMapKey of Object.keys(featureMapping.mapping)) {
            const featureFilePath = featureMapping.mapping[featureMapKey].featureFilePath;
            const feature = evaluatedFeatures.find(({ filePath }) => filePath === featureFilePath)!;
            const contexts: Record<string, string> = {};
            const featureDependencies: SomeFeature[] = [
                feature.features[0].value,
                ...feature.features[0].value.dependencies
            ];

            const visitedDeps: Record<string, SomeFeature> = {};

            while (featureDependencies.length > 0) {
                let currDep = featureDependencies.shift();
                while (currDep && visitedDeps[currDep.id]) {
                    currDep = featureDependencies.shift();
                }
                if (!currDep) {
                    break;
                }
                visitedDeps[currDep.id] = currDep;
                const evaluatedFeature = evaluatedFeatures.find(({ id }) => id === currDep!.id);
                if (evaluatedFeature && evaluatedFeature.contexts) {
                    for (const context of evaluatedFeature.contexts) {
                        if (!contexts[context.value.env]) {
                            contexts[context.value.env] = context.value.activeEnvironmentName;
                        }
                    }
                    featureDependencies.push(...evaluatedFeature.features[0].value.dependencies);
                }
            }
            featureMapping.mapping[featureMapKey].context = contexts;
        }
    }
    /**
     * Collect all environment from loaded features and create build configuration for each one.
     */
    public createEnvironmentsEntries(
        evaluatedFeatures: EvaluatedFeature[],
        featureMapping: FeatureMapping
    ): EngineEnvironmentEntry[] {
        const environments: EngineEnvironmentEntry[] = [];
        const featuresFiles = new Set(evaluatedFeatures.map(({ filePath }) => filePath));
        for (const feature of evaluatedFeatures) {
            for (const envDef of feature.environments) {
                const { env: envName, envType: type } = envDef.value;
                const contexts = evaluatedFeatures
                    .map(({ contexts: ctx }) => ctx)
                    .reduce(
                        (prev, acc) => {
                            return [...prev, ...acc.map(({ value }) => value)];
                        },
                        [] as EnvironmentContext[]
                    );
                const environmentContexts = contexts.filter(({ env }) => env === envName);
                const envFiles = this.findEnvironmentSetupFiles(envName, featuresFiles);
                if (type !== 'context') {
                    const target = buildTargetFromType(type);
                    environments.push({
                        isRoot: instanceOf(envDef.value, Environment),
                        target,
                        envFiles,
                        featureMapping,
                        name: envName,
                        entryFilename: `${ENTRY_PREFIX_FILENAME}${envName}-${target}.js`
                    });
                } else {
                    for (const context of environmentContexts) {
                        const { activeEnvironmentName, runtimeEnvType: runtimeType } = context;
                        const ctxEnvName = activeEnvironmentName;
                        const ctxType = runtimeType;
                        const target = buildTargetFromType(ctxType);
                        const contextFiles = this.findContextSetupFiles(envName, ctxEnvName, featuresFiles);
                        environments.push({
                            isRoot: instanceOf(envDef.value, Environment),
                            target,
                            envFiles,
                            featureMapping,
                            contextFiles,
                            name: envName,
                            entryFilename: `${ENTRY_PREFIX_FILENAME}${envName}-${target}.js`
                        });
                    }
                }
            }
        }

        if (environments.length === 0) {
            throw new Error(
                `Could not find main Environment in this feature set [${evaluatedFeatures.map(f => f.filePath)}]`
            );
        }
        return environments;
    }

    private findRootFeatureFiles() {
        const { fs, basePath } = this;
        for (const featureLocation of rootFeatureLocations) {
            const foundFeature = findEngineFiles({ fs, directoryPath: fs.join(basePath, featureLocation) });
            if (foundFeature.features.length) {
                return foundFeature;
            }
        }
        throw new Error(
            `Could not find feature file in:\n` +
                rootFeatureLocations.map(location => fs.join(basePath, location)).join('\n')
        );
    }

    private addToConfigurationsMapping(confObj: { [configName: string]: string }, configFiles: string[]) {
        const { basename } = this.fs;
        for (const configFilePath of configFiles) {
            const configFileName = basename(configFilePath);
            const name = parseConfigFileName(configFileName);
            if (confObj[name]) {
                throw new Error(`Duplicate config file name found in ["${configFilePath}", "${confObj[name]}"]`);
            } else {
                confObj[name] = configFilePath;
            }
        }
        return confObj;
    }
}

/**
 * Group all engine entities that are exported from .feature file (nodejs module)
 *
 * @param filePath
 * @param featureExports
 */
function collectEngineEntities(filePath: string, featureExports: { [exportName: string]: unknown }): EvaluatedFeature {
    const environments: SymbolList<AsyncEnvironment> = [];
    const features: SymbolList<SomeFeature> = [];
    const contexts: SymbolList<EnvironmentContext> = [];

    for (const [name, value] of Object.entries(featureExports)) {
        if (instanceOf(value, Feature)) {
            features.push({ name, value });
        } else if (
            instanceOf(value, SingleEndPointAsyncEnvironment) ||
            instanceOf(value, MultiEndPointAsyncEnvironment) ||
            instanceOf(value, Environment)
        ) {
            environments.push({ name, value });
        } else if (instanceOf(value, EnvironmentContext)) {
            contexts.push({ name, value });
        }
    }
    return {
        id: features.length > 0 ? features[0].value.id : '',
        filePath,
        environments,
        features,
        contexts
    };
}

export function buildTargetFromType(type: EnvironmentTypes): JSRuntime {
    switch (type) {
        case 'window':
        case 'iframe':
            return 'web';
        case 'worker':
            return 'webworker';
        case 'node':
            return 'node';
    }
    return 'web';
}
