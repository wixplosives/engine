import type { PackageJson } from 'type-fest';
import type { IFileSystemSync } from '@file-services/types';
import { Environment, EnvironmentContext, Feature, flattenTree, getFeaturesDeep, SingleEndpointContextualEnvironment } from '@wixc3/engine-core';
import { isPlainObject, isSetMultiMap, SetMultiMap } from '@wixc3/common';
import {
    isFeatureFile,
    parseConfigFileName,
    parseContextFileName,
    parseEnvFileName,
    parseFeatureFileName,
    parsePreloadFileName,
} from '../build-constants';
import { IFeatureDirectory, loadFeatureDirectory } from '../load-feature-directory';
import { evaluateModule } from '../utils/evaluate-module';
import type { IConfigDefinition } from '@wixc3/engine-runtime-node';
import type { IFeatureDefinition, IFeatureModule } from '../types';
import { basename } from 'path';
import { instanceOf } from '../utils/instance-of';
import { parseContextualEnv, parseEnv } from './parse-env';
import { DirFeatures } from './features-from-packages';

interface IPackageDescriptor {
    simplifiedName: string;
    directoryPath: string;
    name: string;
}
export function loadFeaturesFromPaths(
    locations: DirFeatures,
    fs: IFileSystemSync
) {
    const { dirs: ownFeatureDirectoryPaths, files: ownFeatureFilePaths } = locations


    const { featureDirectoryPaths, foundFeatureFilePaths } = findFeaturePaths(ownFeatureFilePaths, ownFeatureDirectoryPaths, fs);
    // this is our actual starting point. we now have a list of directories which contain
    // feature/env/config files, both in our repo and from node_modules.
    const featureDirectories: IFeatureDirectory[] = parseFeatureDirs(featureDirectoryPaths, ownFeatureDirectoryPaths, fs);

    // find closest package.json for each feature directory and generate package name
    const directoryToPackage = findPackageJsons(featureDirectoryPaths, fs);

    const foundFeatures = new Map<string, IFeatureDefinition>();
    const foundConfigs = new SetMultiMap<string, IConfigDefinition>();
    const featureToScopedName = new Map<Feature, string>();

    // TODO change this loop into indevidual loops per task
    for (const { directoryPath, features, configurations, envs, contexts, preloads } of featureDirectories) {
        const featurePackage = validatePackage(directoryToPackage, directoryPath);

        // pick up configs
        configurations.map(filePath => {
            const { configName: name, envName } = parseConfigFileName(fs.basename(filePath));
            return {
                key: scopeToPackage(featurePackage.simplifiedName, name),
                value: { envName, name, filePath }
            }
        }).forEach(addToMap(foundConfigs))

        // pick up features
        const analyzedFeatures = features.map(analyzeFeature(foundFeatureFilePaths, featurePackage))
        analyzedFeatures.map(a => a && {
            key: a.scopedName,
            value: parseFoundFeature(a, featurePackage, ownFeatureFilePaths)
        }).forEach(addToMap(foundFeatures))
        analyzedFeatures.map(a => a && {
            key: a.module.exportedFeature,
            value: a.scopedName
        }).forEach(addToMap(featureToScopedName))

        // pick up environments, configs and preloads
        envs.forEach(setEnvPath('envFilePaths', parseEnvFileName, fs, foundFeatures, featurePackage))
        contexts.forEach(setEnvPath('contextFilePaths', parseContextFileName, fs, foundFeatures, featurePackage));
        preloads.forEach(setEnvPath('preloadFilePaths', parsePreloadFileName, fs, foundFeatures, featurePackage))
    }

    for (const [featureName, { dependencies, exportedFeature, resolvedContexts }] of foundFeatures) {
        // compute context
        Object.assign(resolvedContexts, computeUsedContext(featureName, foundFeatures));
        // compute dependencies
        dependencies.push(...exportedFeature.dependencies.map((feature) => featureToScopedName.get(feature)!));
    }

    foundFeatures.forEach((def) => Object.assign(def, override))
    return { features: foundFeatures, configurations: foundConfigs };
}

type MapLike<K, V> = SetMultiMap<K, V> | Map<K, V>
const addToMap = <K, V>(mapLike: MapLike<K, V>) =>
    (entry: { key: K, value: V } | null) => {
        if (entry) {
            isSetMultiMap<K, V>(mapLike)
                ? mapLike.add(entry.key, entry.value)
                : mapLike.set(entry.key, entry.value)
        }
        return mapLike
    }

const featurePackagePostfix = '-feature';

type AnalyzedFeatureModule = {
    scopedName: string,
    evaluated: NodeJS.Module | undefined,
    module: IFeatureModule,
    filePath: string,
}

function validatePackage(directoryToPackage: Map<string, IPackageDescriptor>, directoryPath: string) {
    const featurePackage = directoryToPackage.get(directoryPath);
    if (!featurePackage) {
        throw new Error(`cannot find package name for ${directoryPath}`);
    }
    return featurePackage;
}

function setEnvPath(field: keyof IFeatureDefinition, parser: FileNameParser, fs: IFileSystemSync, foundFeatures: Map<string, IFeatureDefinition>, featurePackage: IPackageDescriptor) {
    return (path: string) => {
        const { featureName, envName, childEnvName } = parser(fs.basename(path));
        const existingDefinition = foundFeatures.get(scopeToPackage(featurePackage.simplifiedName, featureName));
        if (existingDefinition && isPlainObject(existingDefinition[field])) {
            const targetEnv = childEnvName ? `${envName}/${childEnvName}` : envName;
            (existingDefinition[field] as Record<string, string>)[targetEnv] = path;
        }
    }
}

function analyzeFeature(foundFeatureFilePaths: Set<string>, featurePackage: IPackageDescriptor): (value: string, index: number, array: string[]) => AnalyzedFeatureModule | null {
    return filePath => {
        const [evaluated] = evaluateModule(filePath).children;
        const module = analyzeFeatureModule(evaluated!);
        if (foundFeatureFilePaths.has(filePath)) {
            const scopedName = scopeToPackage(featurePackage.simplifiedName, module.name)!;
            return {
                scopedName,
                evaluated,
                module,
                filePath
            } as AnalyzedFeatureModule;
        }
        return null;
    };
}

function parseFoundFeature({
    module,
    scopedName,
    filePath
}: AnalyzedFeatureModule, featurePackage: IPackageDescriptor, ownFeatureFilePaths: Set<string>): IFeatureDefinition {
    return {
        ...module,
        scopedName,
        dependencies: [],
        envFilePaths: {},
        contextFilePaths: {},
        preloadFilePaths: {},
        resolvedContexts: {},
        isRoot: ownFeatureFilePaths.has(filePath),
        packageName: featurePackage.name,
        directoryPath: featurePackage.directoryPath,
        filePath: filePath,
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
    };
}

function parseFeatureDirs(featureDirectoryPaths: Set<string>, ownFeatureDirectoryPaths: Set<string>, fs: IFileSystemSync) {
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
    return featureDirectories;
}

function findFeaturePaths(ownFeatureFilePaths: Set<string>, ownFeatureDirectoryPaths: Set<string>, fs: IFileSystemSync) {
    const foundFeatureFilePaths = new Set<string>(ownFeatureFilePaths);
    // find all require()'ed feature files from initial ones
    const featureModules = getFeatureModules(evaluateModule(Array.from(ownFeatureFilePaths)));
    const featureDirectoryPaths = new Set<string>(ownFeatureDirectoryPaths);
    for (const { filename } of featureModules) {
        foundFeatureFilePaths.add(filename);
        featureDirectoryPaths.add(fs.dirname(filename));
    }
    return { featureDirectoryPaths, foundFeatureFilePaths };
}

function findPackageJsons(featureDirectoryPaths: Set<string>, fs: IFileSystemSync) {
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
    return directoryToPackage;
}

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
