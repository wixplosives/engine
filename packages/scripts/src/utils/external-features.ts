import { join } from 'path';
import { EXTERNAL_FEATURES_BASE_URI } from '../build-constants';
import fs from '@file-services/node';
import type { IBuildManifest } from '../application';
import type { IExternalDefinition, IExternalFeatureNodeDescriptor } from '@wixc3/engine-runtime-node';

export function getExternalFeaturesMetadata(
    pluginDefinitions: IExternalDefinition[],
    basePath: string
): IExternalFeatureNodeDescriptor[] {
    // mapping a feature definition to the entries of each environment of that feature, per target
    return pluginDefinitions.map(({ packageName, outDir = 'dist', packagePath }) => {
        const packageBasePath = getExternalFeatureBasePath({ packagePath, basePath, packageName });
        const { entryPoints, defaultFeatureName, features } = fs.readJsonFileSync(
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
        const [, externalFeatureDefinition] = features.find(([featureName]) => featureName === defaultFeatureName!)!;
        return {
            envEntries,
            ...externalFeatureDefinition,
            name: externalFeatureDefinition.scopedName,
            packageBasePath,
        };
    });
}

export function getExternalFeatureBasePath({
    packagePath,
    basePath,
    packageName,
}: {
    packagePath?: string;
    basePath: string;
    packageName: string;
}) {
    return packagePath
        ? fs.resolve(basePath, packagePath)
        : fs.dirname(require.resolve(fs.join(packageName, 'package.json'), { paths: [basePath] }));
}
