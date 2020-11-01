import { join } from 'path';
import type { IEnvironment, IExtenalFeatureDescriptor, IExternalFeatureDefinition } from '../types';

export function getFeatureFromDefinition(
    { featureName, packageName, outDir }: IExternalFeatureDefinition,
    pluginsBaseDirectory: string
) {
    const pluginEntryPathParts = [pluginsBaseDirectory, packageName];
    const [scope, feature] = featureName.split('/');
    if (scope && feature) {
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
    console.log(environments);
    return pluginDefinitions.map((pluginDefinition) => {
        const { pluginName, pluginEntryPath } = getFeatureFromDefinition(pluginDefinition, pluginsBaseDirectory);
        return {
            name: pluginName,
            envEntries: [...environments].reduce<Record<string, string>>((acc, { name, type }) => {
                acc[name] = join(
                    pluginEntryPath,
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
