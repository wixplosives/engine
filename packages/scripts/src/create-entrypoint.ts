import { join } from 'path';
import { CONFIG_QUERY_PARAM, FEATURE_QUERY_PARAM } from './build-constants';
import {
    ExternalEntrypoint,
    getAllValidConfigurations,
    getConfigLoaders,
    ICreateEntrypointsOptions,
    WebpackFeatureLoaderArguments,
    LoadStatementArguments,
} from './entrypoint-helpers';

const { stringify } = JSON;
export const LOADED_FEATURE_MODULES_NAMESPACE = '_engine_';
const entrypointHelpersPath = require.resolve(join(__dirname, 'entrypoint-helpers'));

export function createExternalBrowserEntrypoint(args: WebpackFeatureLoaderArguments) {
    return `
    import { getTopWindow } from ${JSON.stringify(require.resolve('@wixc3/engine-core'))};
    import { getExternalPublicPath, registerExternalFeature } from ${JSON.stringify(entrypointHelpersPath)};

    const envName = ${JSON.stringify(args.env.env)};
    const target = ${JSON.stringify(args.target)};
    const featureName = ${JSON.stringify(args.scopedName)};
    ${webLoadStatement()}

    const topWindow = getTopWindow(typeof self !== 'undefined' ? self : window);
    __webpack_public_path__= getExternalPublicPath(envName, target, scopedName, topWindow);
    registerExternalFeature('${args.scopedName}', {...${JSON.stringify(args)}, loadStatement});
    `;
}

export function createExternalNodeEntrypoint(args: ExternalEntrypoint) {
    return `import { createFeatureLoaderObject, nodeImportStatement } from ${JSON.stringify(entrypointHelpersPath)};
const args = ${JSON.stringify(args)};
module.exports = {
    '${args.scopedName}': createFeatureLoaderObject({
        ...args,
        target: 'node',
        loadStatement: nodeImportStatement,
    })
}`;
}

export function webImportStatement({ moduleIdentifier, eagerEntrypoint, filePath }: LoadStatementArguments) {
    return `await import(/* webpackChunkName:${moduleIdentifier} */ ${
        eagerEntrypoint ? `/* webpackMode: 'eager' */ ` : ''
    }${JSON.stringify(filePath.slice(0, filePath.lastIndexOf('.')))})`;
}

const webLoadStatement = () => {
    return `const loadStatementFunction = ${webImportStatement.toString()};

    const loadStatement = async ({
        directoryPath,
        filePath,
        moduleIdentifier: scopedName,
        packageName,
        eagerEntrypoint,
    }) => {
        const func = '(async function() { return ' + loadStatementFunction({
            directoryPath,
            filePath,
            moduleIdentifier: scopedName,
            packageName,
            eagerEntrypoint,
        }) + ' })()';
    
        const a = eval(func);
        debugger;
        return a;
    };
    `;
};

export function createMainEntrypoint({
    features,
    childEnvs,
    featureName,
    configName,
    publicPath,
    configurations,
    mode,
    staticBuild,
    publicConfigsRoute,
    config,
    target,
    externalFeaturesRoute,
    eagerEntrypoint,
    env,
}: ICreateEntrypointsOptions) {
    const configs = getAllValidConfigurations(getConfigLoaders(configurations, mode, configName), env.env);
    return `
import * as EngineCore from ${JSON.stringify(require.resolve('@wixc3/engine-core'))};
import { 
    createFeatureLoaders, 
    createConfigLoaders, 
    importStaticConfigs, 
    addConfigsEventListenerForParentEnvironments, 
    loadExternalFeatures, 
    loadRootFeature, 
    getRemoteConfigs 
} from ${JSON.stringify(entrypointHelpersPath)};
if(!self.EngineCore) {
    self.EngineCore = EngineCore;
}
const { getTopWindow, FeatureLoadersRegistry, runEngineApp } = EngineCore;
const features = new Map(${JSON.stringify([...features.entries()])});
const env = ${JSON.stringify(env)};
const eagerEntrypoint = ${JSON.stringify(eagerEntrypoint ?? false)}
const configs = ${JSON.stringify(configs)};

${webLoadStatement()}

const featureLoaders = createFeatureLoaders({ features: features.values(), env, childEnvs: ${JSON.stringify(
        childEnvs
    )}, eagerEntrypoint, target: ${JSON.stringify(target)}, loadStatement });

    
self.${LOADED_FEATURE_MODULES_NAMESPACE} = {};
const configLoaders = createConfigLoaders(configs, loadStatement)

async function main() {
    const envName = env.env;
    const currentWindow = typeof self !== 'undefined' ? self : window;
    const topWindow = getTopWindow(currentWindow);
    const options = new URLSearchParams(topWindow.location.search);
    const isMainEntrypoint = topWindow && currentWindow === topWindow;

    const publicPath = options.has('publicPath') ? options.get('publicPath') : ${
        typeof publicPath === 'string' ? JSON.stringify(publicPath) : '__webpack_public_path__'
    };
    __webpack_public_path__= publicPath;

    const featureName = options.get('${FEATURE_QUERY_PARAM}') || ${stringify(featureName)};
    const configName = options.get('${CONFIG_QUERY_PARAM}') || ${stringify(configName)};
    const config = [];

    ${staticBuild ? 'importStaticConfigs(configLoaders, configName, config)' : ''}
    ${staticBuild && config ? 'addOverrideConfig(overrideConfig, config)' : ''}
    ${
        publicConfigsRoute
            ? `getRemoteConfigs(${JSON.stringify(
                  publicConfigsRoute
              )}, envName, config, configName, featureName, window, topWindow, isMainEntrypoint)`
            : ''
    }
    const fetchedConfigs = {};
    ${
        publicConfigsRoute
            ? `addConfigsEventListenerForParentEnvironments(${JSON.stringify(publicConfigsRoute)},
        window,
        isMainEntrypoint,
        configName,
        featureName,
        fetchedConfigs)`
            : ''
    }

    const { featureLoader, feature, resolvedContexts } = loadRootFeature(featureLoaders, featureName)

    const features = [feature];
    
    const externalFeaturesFetcher = ${
        target === 'electron-renderer'
            ? `${electronRendererExternalFeaturesFetcher()}`
            : `${fetchExternalFeaturesInBrowser()}`
    }

    const externalFeaturesLoader = ${target === 'webworker' ? '(entries) => importScripts(entries)' : loadScripts()}
    
    const externalFeatures = [];
    const loadedExternalFeatures = await loadExternalFeatures({
        envName,
        target: '${target}',
        featureLoader,
        isMainEntrypoint,
        currentWindow: window,
        externalsFilePath: '${externalFeaturesRoute}',
        externalFeatures,
        externalFeaturesFetcher,
        externalFeaturesLoader,
        publicPath
    });

    features.push(...loadedExternalFeatures);

    const runtimeEngine = runEngineApp(
        { config, options, envName, publicPath, features, resolvedContexts }
    );

    return runtimeEngine;
}

main().catch(console.error);
`;
}

function fetchExternalFeaturesInBrowser() {
    return `(externalFeaturesRoute, publicPath) => {
        return isMainEntrypoint ? (${externalFeaturesHttpFethcher()})(externalFeaturesRoute, publicPath) : (${externalFeaturesParentWindowFetcher()})(externalFeaturesRoute)
    }`;
}

function externalFeaturesParentWindowFetcher() {
    return `(externalFeaturesRoute) => {
        return new Promise((res) => {
            const externalsHandler = ({ data: { id, externalFeatures } }) => {
                if(id === externalFeaturesRoute) {
                    currentWindow.removeEventListener('message', externalsHandler);
                    res(externalFeatures);
                }
            };
            currentWindow.addEventListener('message', externalsHandler)
            topWindow.postMessage({
                id: externalFeaturesRoute
            });
        })
    }`;
}

function externalFeaturesHttpFethcher() {
    return `async (externalFeturesRoute, publicPath) => {
        const path = publicPath + publicPath && !publicPath.endsWith('/') ? '/' : '';
        const normalizedExternalFeaturesRoute = !externalFeaturesRoute.startsWith('/') ? externalFeaturesRoute : externalFeaturesRoute.slice(1);
        return (await fetch(path + normalizedExternalFeaturesRoute)).json()
    }`;
}

function electronRendererExternalFeaturesFetcher() {
    return `(externalFeaturesRoute) => await require('electron').ipcRenderer.invoke(externalFeaturesRoute)`;
}

function loadScripts() {
    return `function fetchScripts(scripts) {
                const loadScript = (src) =>
                    new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = src;
                        script.onload = () => resolve();
                        script.onerror = reject;
                        script.crossOrigin = 'anonymous';
                        script.type = 'module';
                        document.head.appendChild(script);
                    });

                return Promise.all(scripts.map(loadScript));
            }`;
}
