import type { IFileSystemSync } from '@file-services/types';
import type { FeatureDescriptor } from '@wixc3/engine-core';
import { concat, getValue, isPlainObject, map } from '@wixc3/common';
import { SetMultiMap } from '@wixc3/patterns';
import {
    FileNameParser,
    parseConfigFileName,
    parseContextFileName,
    parseEnvFileName,
    parsePreloadFileName
} from '../build-constants';
import { loadFeatureDirectory } from '../load-feature-directory';
import { evaluateModule } from '../utils/evaluate-module';
import type { IConfigDefinition } from '@wixc3/engine-runtime-node';
import type { IFeatureDefinition, IFeatureModule } from '../types';
import type { DirFeatures } from './find-features';
import { findPackageOfDirs, IPackageDescriptor, scopeToPackage } from './package-utils';
import { analyzeFeatureModule, computeUsedContext, getFeatureModules } from './module-utils';
import type { INpmPackage } from '@wixc3/resolve-directory-context';

/**
 * Loads the features and configs of given roots and their imported dependencies
 * @param roots files: feature files to load. dirs: dirs to scan for configurations
 * @param fs
 * @param packages known npmPackages
 * @param override overrides to apply to found features
 * @returns
 */
export function loadFeaturesFromPaths(
    roots: DirFeatures,
    fs: IFileSystemSync,
    packages: INpmPackage[] = [],
    override = {}
) {
    const imported = getImportedFeatures(roots, fs);

    // this is our actual starting point. we now have a list of directories which contain
    // feature/env/config files, both in our repo and from node_modules.
    const featureDirectories = concat(
        map(roots.dirs, (path) => loadFeatureDirectory(path, fs)),
        map(imported.dirs, (path) => loadFeatureDirectory(path, fs, true))
    );

    // find closest package.json for each feature directory and generate package name
    const directoryToPackage = findPackageOfDirs(concat(roots.dirs, imported.dirs), fs, packages);

    const foundFeatures = new Map<string, IFeatureDefinition>();
    const foundConfigs = new SetMultiMap<string, IConfigDefinition>();
    const featureToScopedName = new Map<FeatureDescriptor, string>();

    // TODO change this loop into individual loops per task
    for (const { directoryPath, features, configurations, envs, contexts, preloads } of featureDirectories) {
        const featurePackage = getValue(
            directoryToPackage,
            directoryPath,
            `cannot find package name for ${directoryPath}`
        );

        // pick up configs
        configurations.forEach((filePath) => {
            const { configName: name, envName } = parseConfigFileName(fs.basename(filePath));
            foundConfigs.add(scopeToPackage(featurePackage.simplifiedName, name), { envName, name, filePath });
        });

        // pick up features
        const analyzedFeatures = features
            // filter out features that are not root, nor imported -
            // i.e. that exist on the directory but are not required
            .filter((f) => imported.files.has(f) || roots.files.has(f))
            .map((f) => analyzeFeature(f, featurePackage));
        analyzedFeatures.forEach((a) => {
            foundFeatures.set(a.scopedName, parseFoundFeature(a, featurePackage, roots.files.has(a.filePath)));
            featureToScopedName.set(a.module.exportedFeature, a.scopedName);
        });

        // pick up environments, configs and preloads
        envs.forEach(setEnvPath('envFilePaths', parseEnvFileName, fs, foundFeatures, featurePackage));
        contexts.forEach(setEnvPath('contextFilePaths', parseContextFileName, fs, foundFeatures, featurePackage));
        preloads.forEach(setEnvPath('preloadFilePaths', parsePreloadFileName, fs, foundFeatures, featurePackage));
    }

    for (const [featureName, { dependencies, exportedFeature, resolvedContexts }] of foundFeatures) {
        // compute context
        Object.assign(resolvedContexts, computeUsedContext(featureName, foundFeatures));
        // compute dependencies
        dependencies.push(...exportedFeature.dependencies.map((feature) => featureToScopedName.get(feature)!));
    }

    foundFeatures.forEach((def) => Object.assign(def, override));
    return { features: foundFeatures, configurations: foundConfigs };
}

type AnalyzedFeatureModule = {
    scopedName: string;
    evaluated: NodeJS.Module | undefined;
    module: IFeatureModule;
    filePath: string;
};

function setEnvPath(
    field: keyof IFeatureDefinition,
    parser: FileNameParser,
    fs: IFileSystemSync,
    foundFeatures: Map<string, IFeatureDefinition>,
    featurePackage: IPackageDescriptor
) {
    return (path: string) => {
        const { featureName, envName, childEnvName } = parser(fs.basename(path));
        const existingDefinition = foundFeatures.get(scopeToPackage(featurePackage.simplifiedName, featureName));
        if (existingDefinition && isPlainObject(existingDefinition[field])) {
            const targetEnv = childEnvName ? `${envName}/${childEnvName}` : envName;
            (existingDefinition[field] as Record<string, string>)[targetEnv] = path;
        }
    };
}

function analyzeFeature(filePath: string, featurePackage: IPackageDescriptor): AnalyzedFeatureModule {
    const [evaluated] = evaluateModule(filePath).children;
    const module = analyzeFeatureModule(evaluated!);
    const scopedName = scopeToPackage(featurePackage.simplifiedName, module.name)!;
    return {
        scopedName,
        evaluated,
        module,
        filePath,
    };
}

function parseFoundFeature(
    { module, scopedName, filePath }: AnalyzedFeatureModule,
    featurePackage: IPackageDescriptor,
    isRoot: boolean
): IFeatureDefinition {
    return {
        ...module,
        scopedName,
        dependencies: [],
        envFilePaths: {},
        contextFilePaths: {},
        preloadFilePaths: {},
        resolvedContexts: {},
        isRoot,
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
                scopedName
            };
        }
    };
}

function getImportedFeatures(roots: DirFeatures, fs: IFileSystemSync): DirFeatures {
    const imported = {
        dirs: new Set<string>(),
        files: new Set<string>(),
    };
    // find all require()'ed feature files from initial ones
    const featureModules = getFeatureModules(evaluateModule(roots.files));
    for (const { filename } of featureModules) {
        addNew(roots.files, imported.files, filename);
        addNew(roots.dirs, imported.dirs, fs.dirname(filename));
    }
    return imported;
}

function addNew<T>(existing: Set<T>, newItems: Set<T>, item: T) {
    if (!existing.has(item)) {
        newItems.add(item);
    }
}
