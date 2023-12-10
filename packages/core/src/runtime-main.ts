import "./polyfills/report-error-polyfill.js";

import type { IRunOptions, TopLevelConfig } from './types.js';
import type { AnyEnvironment } from './entities/index.js';
import { FeatureLoadersRegistry, IFeatureLoader } from './run-engine-app.js';
import { ConfigLoaders, RuntimeConfigurations } from './runtime-configurations.js';
import { RuntimeEngine } from './runtime-engine.js';
import { INSTANCE_ID_PARAM_NAME } from './com/index.js';

export interface MainEntryParams {
    env: AnyEnvironment;
    featureLoaders: Map<string, IFeatureLoader>;
    configLoaders: ConfigLoaders;
    contextualConfig: (options: { resolvedContexts: Record<string, string> }) => TopLevelConfig;
    publicConfigsRoute: string;
    featureName: string;
    configName: string;
    options: IRunOptions;
}

/**
 * main engine environment entry point flow
 * This function is imported by the generated entry file and is the first function to initialize each environment
 */
export async function main({
    env,
    contextualConfig,
    publicConfigsRoute,
    featureLoaders,
    configLoaders,
    featureName,
    configName,
    options,
}: MainEntryParams) {
    const runtimeConfiguration = new RuntimeConfigurations(env.env, publicConfigsRoute, configLoaders, options);
    const featureLoader = new FeatureLoadersRegistry(featureLoaders);

    runtimeConfiguration.installChildEnvConfigFetcher(featureName, configName);

    featureName = String(options.get('feature') || featureName);
    configName = String(options.get('config') || configName);

    const instanceId = options.get(INSTANCE_ID_PARAM_NAME);
    if (typeof instanceId === 'string' && typeof self !== 'undefined') {
        self.name = instanceId;
    }

    const [buildConfig, runtimeConfig] = await Promise.all([
        runtimeConfiguration.importConfig(configName),
        runtimeConfiguration.load(env.env, featureName, configName),
    ]);

    // only load features after the config is loaded to avoid blocking onload event
    const { entryFeature, resolvedContexts } = await featureLoader.loadEntryFeature(featureName, {});

    return new RuntimeEngine(
        env,
        [...buildConfig, ...contextualConfig({ resolvedContexts }), ...runtimeConfig],
        options,
    ).run(entryFeature);
}
