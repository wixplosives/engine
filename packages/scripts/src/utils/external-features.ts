import { join } from 'path';
import type { IEnvironment, IExtenalFeatureDescriptor, IExternalFeatureDefinition } from '../types';

export function getFeatureFromDefinition({ featureName, packageName, outDir }: IExternalFeatureDefinition) {
    // eslint-disable-next-line prefer-const
    let [monorepoName, realPackageName] = packageName.split('/');
    realPackageName = realPackageName ?? monorepoName;
    const pluginEntryPathParts = [packageName];
    const [scope, feature] = featureName.split('/');
    if (scope && feature && scope !== realPackageName) {
        pluginEntryPathParts.push(feature);
    }
    pluginEntryPathParts.push(outDir ?? 'dist');
    return { pluginName: featureName, pluginEntryPath: join(...pluginEntryPathParts) };
}

export function getExternalFeatures(
    pluginDefinitions: IExternalFeatureDefinition[],
    environments: IEnvironment[],
    pluginsBaseDirectory: string
): IExtenalFeatureDescriptor[] {
    return pluginDefinitions.map((pluginDefinition) => {
        const { pluginName, pluginEntryPath } = getFeatureFromDefinition(pluginDefinition);
        return {
            name: pluginName,
            envEntries: [...environments].reduce<Record<string, string>>((acc, { name, type }) => {
                acc[name] = join(
                    join(type === 'node' ? pluginsBaseDirectory : 'plugins', pluginEntryPath),
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
