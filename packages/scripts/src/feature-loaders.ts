import { IFeatureLoader } from '@wixc3/engine-core';
import { IFeatureDefinition } from './analyze-feature';

export function getFeatureLoaders(
    features: IFeatureDefinition[],
    envName: string,
    childEnvName?: string
): Record<string, IFeatureLoader> {
    const loaders = {} as Record<string, IFeatureLoader>;
    for (const { scopedName, filePath, contextFilePaths, envFilePaths, dependencies, resolvedContexts } of features) {
        const envSetupFilePaths: string[] = [];
        if (childEnvName) {
            const contextFilePath = contextFilePaths[`${envName}/${childEnvName}`];
            if (contextFilePath) {
                envSetupFilePaths.push(contextFilePath);
            }
        }
        const envFilePath = envFilePaths[envName];
        if (envFilePath) {
            envSetupFilePaths.push(envFilePath);
        }
        loaders[scopedName] = {
            load: async () => {
                await Promise.all(envSetupFilePaths.map(async setupFilePath => await import(setupFilePath)));
                return ((await import(filePath)) as any).default;
            },
            depFeatures: dependencies,
            resolvedContexts
        };
    }

    return loaders;
}
