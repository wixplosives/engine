import { Environment } from '@wixc3/engine-core';
import { ICreateEntrypointsOptions, createConfigLoaders, createFeatureLoaders } from './create-entrypoint';

const { stringify } = JSON;

export function createNodeEntrypoint({
    features,
    childEnvs,
    featureName,
    configName,
    mode,
    configurations,
    config = [],
    eagerEntrypoint,
    env,
    featuresBundleName,
}: ICreateEntrypointsOptions) {
    const runningEnv = new Environment(
        env.name,
        env.type,
        env.env.endpointType,
        env.flatDependencies?.map((d) => d.env) ?? []
    );
    const featureLoaders = createFeatureLoaders(features.values(), childEnvs, env, eagerEntrypoint, featuresBundleName);
    const configLoaders = createConfigLoaders(configurations, mode, configName, env, true, nodeLoadConfigFileTemplate);
    return `
import { main } from '@wixc3/engine-core';

const options = new Map();

main({
    featureName: ${stringify(featureName)}, 
    configName: ${stringify(configName)},
    env: ${stringify(runningEnv, null, 2)},
    featureLoaders: ${featureLoaders},
    configLoaders: ${configLoaders},
    publicPath: "", // no public path for node
    publicConfigsRoute: "", // disables fetching configs from server
    overrideConfig: ${stringify(config, null, 2)},
    options,
}).catch(console.error);
`;
}

function nodeLoadConfigFileTemplate(filePath: string): string {
    return `import(${stringify(filePath)})`;
}
