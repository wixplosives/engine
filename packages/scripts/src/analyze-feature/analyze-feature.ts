import type { PackageJson } from 'type-fest';
import type { IFileSystemSync } from '@file-services/types';
import type { Feature } from '@wixc3/engine-core';
import { isPlainObject, isSetMultiMap, SetMultiMap } from '@wixc3/common';
import {
    FileNameParser,
    parseConfigFileName,
    parseContextFileName,
    parseEnvFileName,
    parsePreloadFileName,
} from '../build-constants';
import { IFeatureDirectory, loadFeatureDirectory } from '../load-feature-directory';
import { evaluateModule } from '../utils/evaluate-module';
import type { IConfigDefinition } from '@wixc3/engine-runtime-node';
import type { IFeatureDefinition, IFeatureModule } from '../types';
import type { DirFeatures } from './features-from-packages';
import { scopeToPackage, simplifyPackageName } from './package-utils';
import { analyzeFeatureModule, computeUsedContext, getFeatureModules } from './module-utils';
import type { INpmPackage } from '@wixc3/resolve-directory-context';

interface IPackageDescriptor {
    simplifiedName: string;
    directoryPath: string;
    name: string;
}
export function loadFeaturesFromPaths(
    locations: DirFeatures,
    fs: IFileSystemSync,
    npmPackages: INpmPackage[] = [],
    override = {}
) {
    const { dirs, files } = locations

    const { featureDirectoryPaths: allFeatureDirs, featureFilePaths: allFeatureFiles } = getImportedFeatures(files, dirs, fs);
    // this is our actual starting point. we now have a list of directories which contain
    // feature/env/config files, both in our repo and from node_modules.
    const featureDirectories: IFeatureDirectory[] = parseFeatureDirs(allFeatureDirs, dirs, fs);

    // find closest package.json for each feature directory and generate package name
    const directoryToPackage = findPackageJsons(allFeatureDirs, fs, npmPackages);

    const foundFeatures = new Map<string, IFeatureDefinition>();
    const foundConfigs = new SetMultiMap<string, IConfigDefinition>();
    const featureToScopedName = new Map<Feature, string>();

    // TODO change this loop into individual loops per task
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
        const analyzedFeatures = features.map(analyzeFeature(allFeatureFiles, featurePackage))
        analyzedFeatures.map(a => a && {
            key: a.scopedName,
            value: parseFoundFeature(a, featurePackage, files)
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
            };
        }
        return null;
    };
}

function parseFoundFeature({
    module,
    scopedName,
    filePath
}: AnalyzedFeatureModule, featurePackage: IPackageDescriptor, roots: Set<string>): IFeatureDefinition {
    return {
        ...module,
        scopedName,
        dependencies: [],
        envFilePaths: {},
        contextFilePaths: {},
        preloadFilePaths: {},
        resolvedContexts: {},
        isRoot: roots.has(filePath),
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

function parseFeatureDirs(featureDirectoryPaths: Set<string>, roots: Set<string>, fs: IFileSystemSync) {
    const featureDirectories: IFeatureDirectory[] = [];
    for (const directoryPath of featureDirectoryPaths) {
        const featureDir = loadFeatureDirectory(directoryPath, fs)
        if (!roots.has(directoryPath)) {
            featureDir.configurations = [];
        }
        featureDirectories.push(featureDir);
    }
    return featureDirectories;
}

function getImportedFeatures(ownFeatureFilePaths: Set<string>, ownFeatureDirectoryPaths: Set<string>, fs: IFileSystemSync) {
    const featureFilePaths = new Set<string>(ownFeatureFilePaths);
    // find all require()'ed feature files from initial ones
    const featureModules = getFeatureModules(evaluateModule(ownFeatureFilePaths));
    const featureDirectoryPaths = new Set<string>(ownFeatureDirectoryPaths);
    for (const { filename } of featureModules) {
        featureFilePaths.add(filename);
        featureDirectoryPaths.add(fs.dirname(filename));
    }
    return { featureDirectoryPaths, featureFilePaths };
}

function findPackageJsons(featureDirectoryPaths: Set<string>, fs: IFileSystemSync, npmPackages: INpmPackage[]) {
    const pkgs = new Map(npmPackages.map(pkg => [pkg.directoryPath, pkg]))
    const directoryToPackage = new Map<string, IPackageDescriptor>();
    for (const featureDirectoryPath of featureDirectoryPaths) {
        let name: string|undefined, directoryPath: string,  packageJsonPath:string;
        if (pkgs.has(featureDirectoryPath)) {
            const pkg = pkgs.get(featureDirectoryPath)!
            name = pkg.packageJson.name
            directoryPath = pkg.directoryPath
            packageJsonPath = pkg.packageJsonPath
        } else {
            packageJsonPath = findPackageJson(fs, featureDirectoryPath);
            directoryPath = fs.dirname(packageJsonPath)
            name = (fs.readJsonFileSync(packageJsonPath) as PackageJson).name;
        }
        if (!name) {
            throw new Error(`Invalid package.json: ${packageJsonPath} does not contain a name`)
        }
        directoryToPackage.set(featureDirectoryPath, {
            simplifiedName: simplifyPackageName(name),
            directoryPath,
            name,
        });
    }
    return directoryToPackage;
}

export function findPackageJson(fs: IFileSystemSync, featureDirectoryPath: string) {
    const packageJsonPath = fs.findClosestFileSync(featureDirectoryPath, 'package.json');
    if (!packageJsonPath) {
        throw new Error(`cannot find package.json ${featureDirectoryPath}`);
    }
    return packageJsonPath;
}

