import http from 'http';
import COM from './communication.feature';
import { flattenTree } from './flatten-tree';
import { RuntimeEngine } from './runtime-engine';
import { SomeFeature, TopLevelConfig } from './types';

export function run(entryFeature: SomeFeature | SomeFeature[], topLevelConfig: TopLevelConfig = []): RuntimeEngine {
    return new RuntimeEngine(topLevelConfig).run(entryFeature);
}

export const getFeaturesDeep = (feature: SomeFeature) => flattenTree(feature, f => f.dependencies);

export interface IFeatureLoader {
    load: () => Promise<SomeFeature>;
    depFeatures: string[];
    resolvedContexts: Record<string, string>;
}

export interface IRunEngineAppOptions {
    featureName?: string | null;
    featureLoaders: Record<string, IFeatureLoader>;
    config?: TopLevelConfig;
    httpServerPath: string;
}

export async function runEngineApp({ featureName, featureLoaders, config = [], httpServerPath }: IRunEngineAppOptions) {
    const featureNames = Object.keys(featureLoaders);
    featureName = featureName || featureNames[0];

    const rootFeatureDef = featureLoaders[featureName];
    if (!rootFeatureDef) {
        throw new Error(`cannot find feature "${featureName}". available features: ${featureNames.join(', ')}`);
    }

    const [runningFeature] = await Promise.all([
        rootFeatureDef.load(),
        ...rootFeatureDef.depFeatures.map(depName => featureLoaders[depName].load())
    ]);
    config.push(...(await getConfig(featureName, httpServerPath)));
    const engine = new RuntimeEngine([
        COM.use({ config: { contextMappings: rootFeatureDef.resolvedContexts } }),
        ...config
    ]).run(runningFeature);

    return {
        engine,
        runningFeature
    };
}

export async function getConfig(featureName: string, httpServerPath: string): Promise<Array<[string, object]>> {
    return new Promise((resolve, reject) => {
        http.get(`${httpServerPath}/config?feature=${featureName}`, response => {
            let data = '';
            response.on('data', chunk => {
                data += chunk;
            });
            response.on('end', () => {
                resolve(JSON.parse(data));
            });
            response.on('error', err => {
                reject(err);
            });
        });
    });
}

export function getTopWindow(win: Window): Window {
    while (win.parent && win.parent !== win) {
        win = win.parent;
    }
    return win;
}
