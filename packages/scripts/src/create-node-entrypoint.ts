import { Environment } from '@wixc3/engine-core';
import { createFeatureEnvironmentsMapping } from '@wixc3/engine-runtime-node';
import {
    ICreateEntrypointsOptions,
    createAllValidConfigurationsEnvironmentMapping,
    createConfigLoaders,
    createFeatureLoadersSourceCode,
} from './create-entrypoint';

const { stringify } = JSON;

export function createNodeEnvironmentManagerEntrypoint(
    {
        features,
        configurations,
        mode,
        configName,
    }: Pick<ICreateEntrypointsOptions, 'features' | 'configurations' | 'mode' | 'configName'>,
    moduleType: 'cjs' | 'esm',
) {
    const featureEnvironmentsMapping = createFeatureEnvironmentsMapping(features);
    const configMapping = createAllValidConfigurationsEnvironmentMapping(configurations, mode, configName);

    return `
import { pathToFileURL } from 'node:url';    
import { NodeEnvManager } from '@wixc3/engine-runtime-node';
const featureEnvironmentsMapping = ${stringify(featureEnvironmentsMapping)};
const configMapping = ${stringify(configMapping)};
const meta = { url: ${moduleType === 'esm' ? 'import.meta.url' : 'pathToFileURL(__filename).href'} };
process.env.ENGINE_FLOW_V2_DIST_URL = meta.url; /* compatibility */
new NodeEnvManager(meta, featureEnvironmentsMapping, configMapping).autoLaunch().catch((e)=>{
    process.exitCode = 1;
    console.error(e);
});
`.trimStart();
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
        env.flatDependencies?.map((d) => d.env) ?? [],
    );
    const featureLoaders = createFeatureLoadersSourceCode(
        features.values(),
        childEnvs,
        env,
        eagerEntrypoint,
        featuresBundleName,
    );
    const configLoaders = createConfigLoaders({
        configurations,
        mode,
        configName,
        envName: env.name,
        staticBuild: true,
        loadConfigFileTemplate: (filePath) => `import(${stringify(filePath)})`,
    });
    return `
import { main, COM } from "@wixc3/engine-core";
import { parseRuntimeOptions, ParentPortHost } from "@wixc3/engine-runtime-node";
import { parseArgs } from "node:util";
import { workerData } from "node:worker_threads";

const options = workerData?.runtimeOptions ?? parseRuntimeOptions();
console.log('[${env.name}]: Started with options: ', options);

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
}).then(()=>console.log('[${env.name}]: Running'))
    .catch(e => {
        process.exitCode = 1;
        console.error(e);
    });
`.trimStart();
}
