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
import { main, COM } from '@wixc3/engine-core';
import { parseCliArguments } from '@wixc3/engine-runtime-node';

console.log('${env.name}', parseCliArguments(process.argv.slice(1)));

const args = parseCliArguments(process.argv.slice(1));

const options = new Map(Object.entries(args));

main({
    featureName: ${stringify(featureName)}, 
    configName: ${stringify(configName)},
    env: ${stringify(runningEnv, null, 2)},
    featureLoaders: ${featureLoaders},
    configLoaders: ${configLoaders},
    publicConfigsRoute: "", // disables fetching configs from server
    options,
    contextualConfig: ({ resolvedContexts }) => {
        return [
            COM.use({
                config: {
                    resolvedContexts,
                    // host: new BaseHost(),
                    // id: 'TODO',
                },
            }),
            ...${stringify(config, null, 2)}
        ];
    },
}).catch(console.error);
`;
}

function nodeLoadConfigFileTemplate(filePath: string): string {
    return `import(${stringify(filePath)})`;
}
