import { basename } from 'path';
import type { PackageJson } from 'type-fest';
import type { IFileSystemSync } from '@file-services/types';
import {
    Environment,
    EnvironmentContext,
    Feature,
    getFeaturesDeep,
    SingleEndpointContextualEnvironment,
    SetMultiMap,
    flattenTree,
} from '@wixc3/engine-core';
import {
    isFeatureFile,
    parseConfigFileName,
    parseContextFileName,
    parseEnvFileName,
    parseFeatureFileName,
    parsePreloadFileName,
} from './build-constants';
import { IFeatureDirectory, loadFeatureDirectory } from './load-feature-directory';
import { evaluateModule } from './utils/evaluate-module';
import { instanceOf } from './utils/instance-of';
import type { INpmPackage } from './utils/resolve-packages';
import type { IFeatureDefinition, IConfigDefinition, IFeatureModule, IEnvironment } from '@wixc3/engine-runtime-node';

interface IPackageDescriptor {
    simplifiedName: string;
    directoryPath: string;
    name: string;
}

const featureRoots = ['.', 'src', 'feature', 'fixtures'] as const;

export function loadFeaturesFromPackages(npmPackages: INpmPackage[], fs: IFileSystemSync, featureDiscoveryRoot = '.') {
    const ownFeatureFilePaths = new Set<string>();
    const ownFeatureDirectoryPaths = new Set<string>();

    // pick up own feature files in provided npm packages
    for (const { directoryPath } of npmPackages) {
        for (const rootName of featureRoots) {
            const rootPath = fs.join(directoryPath, featureDiscoveryRoot, rootName);
            if (!fs.directoryExistsSync(rootPath)) {
                continue;
            }
            ownFeatureDirectoryPaths.add(rootPath);
            for (const rootItem of fs.readdirSync(rootPath, { withFileTypes: true })) {
                const itemPath = fs.join(rootPath, rootItem.name);
                if (rootItem.isFile()) {
                    const itemName = rootItem.name;
                    if (isFeatureFile(itemName)) {
                        ownFeatureFilePaths.add(itemPath);
                    }
                } else if (rootName === 'fixtures' && rootItem.isDirectory()) {
                    ownFeatureDirectoryPaths.add(itemPath);
                    for (const subFixtureItem of fs.readdirSync(itemPath, { withFileTypes: true })) {
                        const subFixtureItemPath = fs.join(itemPath, subFixtureItem.name);
                        const itemName = subFixtureItem.name;
                        if (subFixtureItem.isFile() && isFeatureFile(itemName)) {
                            ownFeatureFilePaths.add(subFixtureItemPath);
                        }
                    }
                }
            }
        }
    }
    return loadFeaturesFromPaths(ownFeatureFilePaths, ownFeatureDirectoryPaths, fs);
}

export function loadFeaturesFromPaths(
    ownFeatureFilePaths: Set<string>,
    ownFeatureDirectoryPaths: Set<string>,
    fs: IFileSystemSync
) {
    const foundFeatureFilePaths = new Set<string>(ownFeatureFilePaths);
    // find all require()'ed feature files from initial ones
    const featureModules = getFeatureModules(evaluateModule(Array.from(ownFeatureFilePaths)));
    const featureDirectoryPaths = new Set<string>(ownFeatureDirectoryPaths);
    for (const { filename } of featureModules) {
        foundFeatureFilePaths.add(filename);
        featureDirectoryPaths.add(fs.dirname(filename));
    }

    // this is our actual starting point. we now have a list of directories which contain
    // feature/env/config files, both in our repo and from node_modules.
    const featureDirectories: IFeatureDirectory[] = [];
    for (const directoryPath of featureDirectoryPaths) {
        if (ownFeatureDirectoryPaths.has(directoryPath)) {
            featureDirectories.push(loadFeatureDirectory({ directoryPath, fs }));
        } else {
            featureDirectories.push({
                ...loadFeatureDirectory({ directoryPath, fs }),
                configurations: [],
            });
        }
    }

    // find closest package.json for each feature directory and generate package name
    const directoryToPackage = new Map<string, IPackageDescriptor>();
    for (const featureDirectoryPath of featureDirectoryPaths) {
        const packageJsonPath = fs.findClosestFileSync(featureDirectoryPath, 'package.json');
        if (!packageJsonPath) {
            throw new Error(`cannot find package.json ${featureDirectoryPath}`);
        }
        const { name = fs.basename(fs.dirname(packageJsonPath)) } = fs.readJsonFileSync(packageJsonPath) as PackageJson;
        directoryToPackage.set(featureDirectoryPath, {
            simplifiedName: simplifyPackageName(name),
            directoryPath: fs.dirname(packageJsonPath),
            name,
        });
    }

    const foundFeatures = new Map<string, IFeatureDefinition>();
    const foundConfigs = new SetMultiMap<string, IConfigDefinition>();
    const featureToScopedName = new Map<Feature, string>();

    for (const { directoryPath, features, configurations, envs, contexts, preloads } of featureDirectories) {
        const featurePackage = directoryToPackage.get(directoryPath);
        if (!featurePackage) {
            throw new Error(`cannot find package name for ${directoryPath}`);
        }

        // pick up configs
        for (const filePath of configurations) {
            const { configName, envName } = parseConfigFileName(fs.basename(filePath));
            const scopedConfigName = scopeToPackage(featurePackage.simplifiedName, configName);
            foundConfigs.add(scopedConfigName, {
                envName,
                name: configName,
                filePath,
            });
        }

        // pick up features
        for (const featureFilePath of features) {
            const [evaluatedFeature] = evaluateModule(featureFilePath).children;
            const featureModule = analyzeFeatureModule(evaluatedFeature!);
            const featureName = featureModule.name;
            if (!foundFeatureFilePaths.has(featureFilePath)) {
                continue;
            }
            const scopedName = scopeToPackage(featurePackage.simplifiedName, featureName);
            foundFeatures.set(scopedName, {
                ...featureModule,
                scopedName,
                dependencies: [],
                envFilePaths: {},
                contextFilePaths: {},
                preloadFilePaths: {},
                resolvedContexts: {},
                isRoot: ownFeatureFilePaths.has(featureFilePath),
                packageName: featurePackage.name,
                directoryPath: featurePackage.directoryPath,
                filePath: featureFilePath,
                toJSON(this: IFeatureDefinition) {
                    return {
                        contextFilePaths: this.contextFilePaths,
                        dependencies: this.dependencies,
                        filePath: this.filePath,
                        envFilePaths: this.envFilePaths,
                        preloadFilePaths: this.preloadFilePaths,
                        exportedEnvs: this.exportedEnvs,
                        resolvedContexts: this.resolvedContexts,
                        packageName: this.packageName,
                        scopedName,
                    };
                },
            });
            featureToScopedName.set(featureModule.exportedFeature, scopedName);
        }

        // pick up environments
        for (const envFilePath of envs) {
            const { featureName, envName, childEnvName } = parseEnvFileName(fs.basename(envFilePath));
            const existingDefinition = foundFeatures.get(scopeToPackage(featurePackage.simplifiedName, featureName));
            if (existingDefinition) {
                const targetEnv = childEnvName ? `${envName}/${childEnvName}` : envName;
                if (!existingDefinition.envFilePaths) {
                    existingDefinition.envFilePaths = {};
                }
                existingDefinition.envFilePaths[targetEnv] = envFilePath;
            }
        }

        // pick up context files and add them to feature definitions
        for (const contextFilePath of contexts) {
            const { featureName, envName, childEnvName } = parseContextFileName(fs.basename(contextFilePath));
            const contextualName = `${envName}/${childEnvName}`;
            const existingDefinition = foundFeatures.get(scopeToPackage(featurePackage.simplifiedName, featureName));
            if (existingDefinition && existingDefinition.contextFilePaths) {
                existingDefinition.contextFilePaths[contextualName] = contextFilePath;
            }
        }

        for (const preloadFile of preloads) {
            const { featureName, envName, childEnvName } = parsePreloadFileName(fs.basename(preloadFile));
            const existingDefinition = foundFeatures.get(scopeToPackage(featurePackage.simplifiedName, featureName));
            const contextualName = childEnvName ? `${envName}/${childEnvName}` : envName;
            if (existingDefinition && existingDefinition.preloadFilePaths) {
                existingDefinition.preloadFilePaths[contextualName] = preloadFile;
            }
        }
    }

    for (const [featureName, { dependencies, exportedFeature, resolvedContexts }] of foundFeatures) {
        // compute context
        Object.assign(resolvedContexts, computeUsedContext(featureName, foundFeatures));

        // compute dependencies
        if (dependencies) {
            dependencies.push(...exportedFeature.dependencies.map((feature) => featureToScopedName.get(feature)!));
        }
    }

    return { features: foundFeatures, configurations: foundConfigs };
}

const featurePackagePostfix = '-feature';

function scopeToPackage(packageName: string, entityName: string) {
    return packageName === entityName ? entityName : `${packageName}/${entityName}`;
}

/**
 * Removes package scope (e.g `@wix`) and posfix `-feature`.
 */
export function simplifyPackageName(name: string) {
    const indexOfSlash = name.indexOf('/');
    if (name.startsWith('@') && indexOfSlash !== -1) {
        name = name.slice(indexOfSlash + 1);
    }
    if (name.endsWith(featurePackagePostfix)) {
        name = name.slice(0, -featurePackagePostfix.length);
    }
    return name;
}

export function analyzeFeatureModule({ filename: filePath, exports }: NodeJS.Module): IFeatureModule {
    if (typeof exports !== 'object' || exports === null) {
        throw new Error(`${filePath} does not export an object.`);
    }

    const { default: exportedFeature } = exports as { default: Feature };

    if (!instanceOf(exportedFeature, Feature)) {
        throw new Error(`${filePath} does not "export default" a Feature.`);
    }

    const featureFile: IFeatureModule = {
        filePath,
        name: parseFeatureFileName(basename(filePath)),
        exportedFeature,
        exportedEnvs: [],
        usedContexts: {},
    };

    if (typeof exports === 'object' && exports !== null) {
        const { exportedEnvs: envs = [], usedContexts = {} } = featureFile;
        for (const exportValue of Object.values(exports)) {
            if (instanceOf(exportValue, Environment)) {
                if (instanceOf(exportValue, SingleEndpointContextualEnvironment)) {
                    envs.push(...parseContextualEnv(exportValue));
                } else {
                    envs.push(parseEnv(exportValue));
                }
            } else if (instanceOf(exportValue, EnvironmentContext)) {
                usedContexts[exportValue.env] = exportValue.activeEnvironmentName;
            }
        }
    }
    return featureFile;
}

const parseEnv = ({ env, envType }: InstanceType<typeof Environment>): IEnvironment => ({
    name: env,
    type: envType,
});

const parseContextualEnv = ({
    env,
    environments,
}: InstanceType<typeof SingleEndpointContextualEnvironment>): IEnvironment[] =>
    environments.map((childEnv) => ({
        name: env,
        type: childEnv.envType,
        childEnvName: childEnv.env,
    }));

export const getFeatureModules = (module: NodeJS.Module) =>
    flattenTree(
        module,
        (m) => m.children,
        (m) => isFeatureFile(basename(m.filename))
    );

export function computeUsedContext(featureName: string, features: Map<string, IFeatureDefinition>) {
    const featureToDef = new Map<Feature, IFeatureDefinition>();
    for (const featureDef of features.values()) {
        featureToDef.set(featureDef.exportedFeature, featureDef);
    }

    const feature = features.get(featureName);
    if (!feature) {
        throw new Error(`context compute: cannot find feature "${featureName}"`);
    }

    return Array.from(getFeaturesDeep(feature.exportedFeature))
        .reverse()
        .map((f) => {
            if (!featureToDef.has(f)) {
                throw new Error(
                    `Cannot find feature definition for feature with id: ${f.id}. This usually occurs due to duplicate engine/feature versions. Check your lock file.`
                );
            }
            return featureToDef.get(f)!;
        })
        .reduce((acc, { usedContexts }) => Object.assign(acc, usedContexts), {} as Record<string, string>);
}
