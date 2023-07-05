import { Environment } from '@wixc3/engine-core';
import { ICreateEntrypointsOptions, createConfigLoaders, createFeatureLoaders } from './create-entrypoint';

const { stringify } = JSON;

export function createMainEntrypoint({
    features,
    childEnvs,
    featureName,
    configName,
    publicPath,
    publicPathVariableName,
    configurations,
    mode,
    staticBuild,
    publicConfigsRoute,
    config = [],
    eagerEntrypoint,
    env,
    featuresBundleName,
    configLoaderModuleName,
}: ICreateEntrypointsOptions) {
    const runningEnv = new Environment(
        env.name,
        env.type,
        env.env.endpointType,
        env.flatDependencies?.map((d) => d.env) ?? []
    );
    const configLoaders = createConfigLoaders(
        configurations,
        mode,
        configName,
        env,
        staticBuild,
        webLoadConfigFileTemplate.bind(null, configLoaderModuleName)
    );
    const runtimePublicPath = handlePublicPathTemplate(publicPath, publicPathVariableName);
    const featureLoaders = createFeatureLoaders(features.values(), childEnvs, env, eagerEntrypoint, featuresBundleName);

    return `
import { main, COM } from '@wixc3/engine-core';

// import process from "process";
// globalThis.process = process;

const urlParams = new URLSearchParams(globalThis.location.search);
const options = globalThis.engineEntryOptions?.({ urlParams, envName: ${stringify(env.name)} }) ?? urlParams;
const runtimePublicPath = ${runtimePublicPath};
main({
    featureName: ${stringify(featureName)}, 
    configName: ${stringify(configName)},
    env: ${stringify(runningEnv, null, 2)},
    featureLoaders: ${featureLoaders},
    configLoaders: ${configLoaders},    
    publicConfigsRoute: ${stringify(publicConfigsRoute)},
    options,
    contextualConfig: ({ resolvedContexts }) => {
        return [
            COM.use({
                config: {
                    publicPath: runtimePublicPath,
                    resolvedContexts,
                },
            }),
            ...${stringify(config, null, 2)}
        ];
    },
}).catch(console.error);
`;
}

function handlePublicPathTemplate(publicPath: string | undefined, publicPathVariableName: string | undefined) {
    return `(() => {
// TODO: getTopWindow here???
const topWindow = globalThis.parent ?? globalThis;
let publicPath = ${typeof publicPath === 'string' ? stringify(publicPath) : '__webpack_public_path__'}
if (options.has('publicPath')) {
    publicPath = options.get('publicPath');
} else if (${typeof publicPathVariableName === 'string'} && topWindow[${stringify(publicPathVariableName)}]) {
    publicPath = topWindow[${stringify(publicPathVariableName)}];
}
__webpack_public_path__= publicPath;
return publicPath;
})()`;
}

const topLevelConfigLoaderPath = require.resolve('./top-level-config-loader');

function webLoadConfigFileTemplate(
    configLoaderModuleName: string | undefined = '@wixc3/engine-scripts/dist/default-config-loader',
    filePath: string,
    scopedName: string,
    configEnvName = ''
): string {
    const request = stringify(
        topLevelConfigLoaderPath +
            `?configLoaderModuleName=${configLoaderModuleName}&scopedName=${scopedName}&envName=${configEnvName}!` +
            filePath
    );
    return `import(/* webpackChunkName: "[config]${scopedName}${configEnvName}" */ /* webpackMode: 'eager' */ ${request})`;
}
