import { dirname, join } from 'path';
import { EXTERNAL_FEATURES_BASE_URI } from '../commons';
import type { IEnvironment, IExtenalFeatureDescriptor, IExternalDeclaration, IExternalDefinition } from '../types';
import fs from '@file-services/node';
import type { IBuildManifest } from '../application';

export function getFeatureFromDefinition({ featureName, packageName, outDir }: IExternalDefinition) {
    // eslint-disable-next-line prefer-const
    let [monorepoName, realPackageName] = packageName.split('/');
    realPackageName = realPackageName ?? monorepoName;
    const pluginEntryPathParts = [packageName];
    const [scope, feature] = featureName.split('/');
    if (scope && feature && scope === realPackageName) {
        pluginEntryPathParts.push(feature);
    }
    pluginEntryPathParts.push(outDir ?? 'dist');
    return { pluginName: featureName, pluginEntryPath: join(...pluginEntryPathParts) };
}

export function getExternalFeatures(
    pluginDefinitions: IExternalDeclaration[],
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
        const { pluginName, pluginEntryPath } = getFeatureFromDefinition({
            featureName: externalPackageManifest.defaultFeatureName!,
            packageName: featureDefinition.packageName,
            outDir,
        });
        return {
            name: pluginName,
            envEntries: [...environments].reduce<Record<string, string>>((acc, { name, type }) => {
                acc[name] = join(
                    join(type === 'node' ? pluginsBaseDirectory : EXTERNAL_FEATURES_BASE_URI, pluginEntryPath),
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
