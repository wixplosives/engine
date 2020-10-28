import { join } from 'path';
import type { IEnvironment, IExtenalFeatureDescriptor, IExternalFeatureDefinition } from '../types';

export function getFeatureFromDefinition(pluginDefinition: IExternalFeatureDefinition) {
    const pluginName = typeof pluginDefinition === 'string' ? pluginDefinition : Object.keys(pluginDefinition)[0];
    const pluginEntryPath =
        typeof pluginDefinition === 'string' ? join('plugins', pluginName, 'dist') : pluginDefinition[pluginName];
    console.log(pluginDefinition);
    return { pluginName, pluginEntryPath };
}

export function getExternalFeatures(
    pluginDefinitions: IExternalFeatureDefinition[],
    environments: IEnvironment[]
): IExtenalFeatureDescriptor[] {
    return pluginDefinitions.map((pluginDefinition) => {
        const { pluginName, pluginEntryPath } = getFeatureFromDefinition(pluginDefinition);
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
