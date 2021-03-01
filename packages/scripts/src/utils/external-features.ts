import { join } from 'path';
import { EXTERNAL_FEATURES_BASE_URI } from '../build-constants';
import type { IExtenalFeatureDescriptor, IExternalDefinition, IFeatureDefinition } from '../types';
import fs from '@file-services/node';
import type { IBuildManifest } from '../application';
import { flattenTree } from '@wixc3/engine-core';

export function getExternalFeaturesMetadata(
    pluginDefinitions: IExternalDefinition[],
    basePath: string
): IExtenalFeatureDescriptor[] {
    // mapping a feature definition to the entries of each environment of that feature, per target
    return pluginDefinitions.map(({ packageName, outDir = 'dist', packagePath }) => {
        const packageBasePath = packagePath
            ? fs.resolve(basePath, packagePath)
            : require.resolve(packageName, { paths: [basePath] });
        const { entryPoints, defaultFeatureName } = fs.readJsonFileSync(
            fs.join(packageBasePath, outDir, 'manifest.json')
        ) as IBuildManifest;
        const envEntries: Record<string, Record<string, string>> = {};
        for (const [envName, entriesByTarget] of Object.entries(entryPoints)) {
            for (const [target, entryPath] of Object.entries(entriesByTarget)) {
                envEntries[envName] = {
                    ...envEntries[envName],
                    [target]:
                    // if target is node, the path to the entry will be the path to the entry file
                    // otherwise it will be mapped to a path from where this package will be served
                        target === 'node'
                            ? join(packageBasePath, entryPath)
                            : join(EXTERNAL_FEATURES_BASE_URI, packageName, entryPath),
                };
            }
        }
        return {
            name: defaultFeatureName!,
            envEntries,
        };
    });
}

export function getDefinedExternals(feature: IFeatureDefinition, features: Map<string, IFeatureDefinition>) {
    const externalDefinitions = [
        ...flattenTree(feature, ({ dependencies }) => dependencies.map((dep) => features.get(dep)!)).values(),
    ]
        .map(({ externalDefinitions }) => externalDefinitions)
        .flat();
    const definedExternals: Record<string, string> = {};
    for (const { globalName, request } of externalDefinitions) {
        definedExternals[request] = globalName;
    }
    return definedExternals;
}
