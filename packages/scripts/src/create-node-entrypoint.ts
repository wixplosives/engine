import { Environment } from '@wixc3/engine-core';
import { ICreateEntrypointsOptions, createConfigLoaders, createFeatureLoaders } from './create-entrypoint';
import { createFeatureEnvironmentsMapping } from '@wixc3/engine-runtime-node';

const { stringify } = JSON;

export function createNodeEnvironmentManagerEntrypoint({ features }: Pick<ICreateEntrypointsOptions, 'features'>) {
    const featureToEnvironments = createFeatureEnvironmentsMapping(features);

    return `
        import { NodeEnvManager } from '@wixc3/engine-runtime-node';
        const featureEnvironmentsMapping = ${stringify(featureToEnvironments)};
        new NodeEnvManager(import.meta, featureEnvironmentsMapping).autoLaunch().catch((e)=>{
            process.exitCode = 1;
            console.error(e);
        });
    `;
}

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
import { ParentPortHost } from '@wixc3/engine-runtime-node';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
    strict: false,
    allowPositionals: false
});

console.log('[${env.name}]: Started with args: ' + JSON.stringify(args, null, 2));

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
                    host: new ParentPortHost(),
                    id: options.get('environment_id') ?? 'unknown_environment',
                },
            }),
            ...${stringify(config, null, 2)}
        ];
    },
}).then(()=>console.log('[${env.name}]: Running')).catch(console.error);
`;
}

function nodeLoadConfigFileTemplate(filePath: string): string {
    return `import(${stringify(filePath)})`;
}
