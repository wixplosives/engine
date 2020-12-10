import { join } from 'path';
import { EXTERNAL_FEATURES_BASE_URI } from '../build-constants';
import type { IExtenalFeatureDescriptor, IExternalDefinition } from '../types';
import fs from '@file-services/node';
import type { IBuildManifest } from '../application';

export function getExternalFeaturesMetadata(
    pluginDefinitions: IExternalDefinition[],
    engineConfigPath: string,
    pluginsBaseDirectory: string
): IExtenalFeatureDescriptor[] {
    // mapping a feature definition to the entries of each environment of that feature, per target
    return pluginDefinitions.map(({ packageName, outDir = 'dist', packagePath }) => {
        const packageBasePath = packagePath
            ? fs.resolve(engineConfigPath, packagePath)
            : join(pluginsBaseDirectory, packageName);
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
