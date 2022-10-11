import type { PackageJson } from 'type-fest';
import type { IFileSystemSync } from '@file-services/types';
import type { Feature } from '@wixc3/engine-core';
import { SetMultiMap } from '@wixc3/common';
import {
    parseConfigFileName,
    parseContextFileName,
    parseEnvFileName,
    parsePreloadFileName,
} from '../build-constants';
import { IFeatureDirectory, loadFeatureDirectory } from '../load-feature-directory';
import { evaluateModule } from '../utils/evaluate-module';
import type { IConfigDefinition } from '@wixc3/engine-runtime-node';
import type { IFeatureDefinition } from '../types';
import { analyzeFeatureModule, computeUsedContext, getFeatureModules } from './module-utils';
import { scopeToPackage, simplifyPackageName } from './package-utils';

interface IPackageDescriptor {
    simplifiedName: string;
    directoryPath: string;
    name: string;
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
                existingDefinition.envFilePaths[targetEnv] = envFilePath;
            }
        }

        // pick up context files and add them to feature definitions
        for (const contextFilePath of contexts) {
            const { featureName, envName, childEnvName } = parseContextFileName(fs.basename(contextFilePath));
            const contextualName = `${envName}/${childEnvName}`;
            const existingDefinition = foundFeatures.get(scopeToPackage(featurePackage.simplifiedName, featureName));
            if (existingDefinition) {
                existingDefinition.contextFilePaths[contextualName] = contextFilePath;
            }
        }

        for (const preloadFile of preloads) {
            const { featureName, envName, childEnvName } = parsePreloadFileName(fs.basename(preloadFile));
            const existingDefinition = foundFeatures.get(scopeToPackage(featurePackage.simplifiedName, featureName));
            const contextualName = childEnvName ? `${envName}/${childEnvName}` : envName;
            if (existingDefinition) {
                existingDefinition.preloadFilePaths[contextualName] = preloadFile;
            }
        }
    }

    for (const [featureName, { dependencies, exportedFeature, resolvedContexts }] of foundFeatures) {
        // compute context
        Object.assign(resolvedContexts, computeUsedContext(featureName, foundFeatures));

        // compute dependencies
        dependencies.push(...exportedFeature.dependencies.map((feature) => featureToScopedName.get(feature)!));
    }

    return { features: foundFeatures, configurations: foundConfigs };
}
