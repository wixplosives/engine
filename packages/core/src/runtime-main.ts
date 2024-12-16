import {
    RUN_OPTIONS_PROVIDED_KIND,
    RUN_OPTIONS_REQUESTED_KIND,
    type IRunOptions,
    type TopLevelConfig,
} from './types.js';
import type { AnyEnvironment } from './entities/index.js';
import { FeatureLoadersRegistry, IFeatureLoader } from './run-engine-app.js';
import { ConfigLoaders, RuntimeConfigurations } from './runtime-configurations.js';
import { RuntimeEngine } from './runtime-engine.js';
import { FETCH_OPTIONS_PARAM_NAME, INSTANCE_ID_PARAM_NAME } from './com/index.js';

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
    options: providedOptions,
}: MainEntryParams) {
    const fetchOptionsFromParent = providedOptions.get(FETCH_OPTIONS_PARAM_NAME) === 'true';
    const options = fetchOptionsFromParent ? await getRunningOptionsFromParent(providedOptions) : providedOptions;
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

/**
 * Request run options from parent window and combine with current options.
 * @param options current options to be overridden by options from parent
 * @returns promise with combined options
 */
async function getRunningOptionsFromParent(options: IRunOptions) {
    if (window.parent === window) {
        // if there is no parent window then we assume intentional usage of the env
        return options;
    }

    return await new Promise<IRunOptions>((resolve, reject) => {
        function listenForEnvId(evt: MessageEvent) {
            if ('kind' in evt.data && evt.data.kind === RUN_OPTIONS_PROVIDED_KIND) {
                window.removeEventListener('message', listenForEnvId);
                const paramsFromParent = new URLSearchParams(evt.data.runOptionsParams);
                for (const [key, value] of options) {
                    if (!paramsFromParent.has(key) && value) {
                        paramsFromParent.set(key, value.toString());
                    }
                }
                resolve(paramsFromParent);
            }
        }

        window.addEventListener('message', listenForEnvId);
        window.parent.postMessage(
            {
                kind: RUN_OPTIONS_REQUESTED_KIND,
            },
            '*',
        );
    });
}
