import { join, resolve } from 'path';
import { EXTERNAL_FEATURES_BASE_URI } from '../commons';
import type { IExtenalFeatureDescriptor, IExternalDefinition } from '../types';
import fs from '@file-services/node';
import type { IBuildManifest } from '../application';

export function getExternalFeatures(
    pluginDefinitions: IExternalDefinition[],
    pluginsBaseDirectory: string
): IExtenalFeatureDescriptor[] {
    return pluginDefinitions.map(({ packageName, outDir = 'dist', packagePath }) => {
        const packageBasePath = packagePath ? resolve(packagePath) : join(pluginsBaseDirectory, packageName);
        const { entryPoints, defaultFeatureName } = fs.readJsonFileSync(
            fs.join(packageBasePath, outDir, 'manifest.json')
        ) as IBuildManifest;
        const envEntries: Record<string, Record<string, string>> = {};
        for (const [envName, entriesByTarget] of Object.entries(entryPoints)) {
            for (const [target, entryPath] of Object.entries(entriesByTarget)) {
                envEntries[envName] = {
                    ...envEntries[envName],
                    [target]:
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
