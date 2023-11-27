import { Environment } from '@wixc3/engine-core';
import { ConfigurationEnvironmentMapping, FeatureEnvironmentMapping } from '@wixc3/engine-runtime-node';
import { ICreateEntrypointsOptions, createConfigLoaders, createFeatureLoadersSourceCode } from './create-entrypoint';

const { stringify } = JSON;

export function createNodeEnvironmentManagerEntrypoint({
    featureEnvironmentsMapping,
    configMapping,
    moduleType,
}: {
    featureEnvironmentsMapping: FeatureEnvironmentMapping;
    configMapping: ConfigurationEnvironmentMapping;
    moduleType: 'cjs' | 'esm';
}) {
    return `
import { pathToFileURL } from 'node:url';    
import { NodeEnvManager } from '@wixc3/engine-runtime-node';

const featureEnvironmentsMapping = ${stringify(featureEnvironmentsMapping)};
const configMapping = ${stringify(configMapping)};
const meta = { url: ${moduleType === 'esm' ? 'import.meta.url' : 'pathToFileURL(__filename).href'} };
const manager = new NodeEnvManager(meta, featureEnvironmentsMapping, configMapping);

manager.autoLaunch().then(({ port })=>{
    console.log(\`[ENGINE]: http server is listening on http://localhost:\${port}\`);
}).catch((e)=>{
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
import { bindMetricsListener, parseRuntimeOptions, ParentPortHost } from "@wixc3/engine-runtime-node";
import { parseArgs } from "node:util";
import { workerData } from "node:worker_threads";

const options = workerData?.runtimeOptions ?? parseRuntimeOptions();
const verbose = options.get('verbose') ?? false;
const envId = options.get('environment_id') ?? 'unknown_environment';
if (verbose) {
    console.log('[${env.name}]: Started with options: ', options);
}

const unbindMetricsListener = bindMetricsListener();

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
                    id: envId,
                },
            }),
            ...${stringify(config, null, 2)}
        ];
    },
}).then(()=>{
    if (verbose) {
        console.log('[${env.name}]: Running')
    }
}).catch(e => {
    unbindMetricsListener();
    process.exitCode = 1;
    console.error(envId, e, { runtimeOptions: options });
});
`.trimStart();
}
