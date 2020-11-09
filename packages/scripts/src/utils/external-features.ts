import { dirname, join } from 'path';
import { EXTERNAL_FEATURES_BASE_URI } from '../commons';
import type { IEnvironment, IExtenalFeatureDescriptor, IExternalDefinition } from '../types';
import fs from '@file-services/node';
import type { IBuildManifest } from '../application';

export function getExternalFeatures(
    pluginDefinitions: IExternalDefinition[],
    environments: IEnvironment[],
    pluginsBaseDirectory: string
): IExtenalFeatureDescriptor[] {
    return pluginDefinitions.map((featureDefinition) => {
        const outDir = featureDefinition.outDir ?? 'dist';
        const packageJsonPath = join(featureDefinition.packageName, 'package.json');
        const externalPackageManifest = fs.readJsonFileSync(
            join(
                dirname(
                    require.resolve(packageJsonPath, {
                        paths: [pluginsBaseDirectory],
                    })
                ),
                outDir,
                'manifest.json'
            )
        ) as IBuildManifest;
        return {
            name: externalPackageManifest.defaultFeatureName!,
            envEntries: [...environments].reduce<Record<string, string>>((acc, { name, type }) => {
                acc[name] = join(
                    join(
                        type === 'node' ? pluginsBaseDirectory : EXTERNAL_FEATURES_BASE_URI,
                        featureDefinition.packageName,
                        outDir
                    ),
                    `${name}.${
                        ['electron-renerer', 'iframe', 'window'].includes(type)
                            ? 'web'
                            : type === 'worker'
                            ? 'webworker'
                            : type
                    }.js`
                );
                return acc;
            }, {} as Record<string, string>),
        };
    });
}
