import { run, TopLevelConfig } from '@wixc3/engine-core';
import deindent from 'deindent';
import { CONFIG_QUERY_PARAM, CORE_PACKAGE, FEATURE_QUERY_PARAM } from '../build-constants';
import { EngineEnvironmentDef, FeatureMapping, JSRuntime } from '../types';

/**
 * Builder to generate engine entry files
 */
export class EnvironmentEntryBuilder {
    public runEntry(
        featureToUse: string,
        configToLoad: string,
        {
            featureMapping,
            envFiles,
            contextFiles = new Set<string>()
        }: Pick<EngineEnvironmentDef, 'envFiles' | 'featureMapping' | 'contextFiles'>,
        overrideConfig: TopLevelConfig = []
    ) {
        console.error('overrideConfig', overrideConfig);
        contextFiles.forEach(contextFile => require(contextFile));
        envFiles.forEach(filePath => require(filePath));

        const mainFeature = featureMapping.mapping[featureToUse];

        /* Load config */
        const currentFeature = require(mainFeature.featureFilePath).default;
        const currentConfig = require(mainFeature.configurations[configToLoad]).default;
        /* Run the engine */
        return {
            engine: run([currentFeature], [...currentConfig, ...overrideConfig]),
            runningFeature: currentFeature
        };
    }
    public buildDynamic({
        name,
        target,
        featureMapping,
        envFiles = new Set(),
        contextFiles = new Set()
    }: Pick<EngineEnvironmentDef, 'name' | 'target' | 'featureMapping' | 'envFiles' | 'contextFiles'>) {
        const rootFeatureName = featureMapping.rootFeatureName;
        const currentConfigSymbol = 'currentConfig';
        const currentFeatureSymbol = 'currentFeature';
        const imports: string[] = [];

        contextFiles.forEach(filePath => imports.push(esmImport({ from: filePath })));
        envFiles.forEach(filePath => imports.push(esmImport({ from: filePath })));

        imports.push(esmImport({ from: CORE_PACKAGE, names: ['run', 'COM'] }));
        const entryCode = deindent`
        /* Environment: "${name}" | Target: "${target}" */
        ${imports.join('\n')}
        
        const contexts = ${this.createContextsObject(featureMapping)}
        const topLocation = typeof parent !== 'undefined' ? parent.location : location
        const options = new URLSearchParams(topLocation.search);
        
        async function runEngine(options = new Map(), overrideConfig = []){
            /* Available features */
            ${this.createFeaturesObject(featureMapping)}
            /* Available configurations */
            const loadEmpty = () => Promise.resolve({default: []});
            ${this.createConfigObject(featureMapping)}
            
            const featureToUse = options.get("${FEATURE_QUERY_PARAM}") || "${rootFeatureName}";
            const configToLoad = options.get("${CONFIG_QUERY_PARAM}") || features[featureToUse].defaultConfig;
            
            /* Load config */
            const [${currentFeatureSymbol}, ${currentConfigSymbol}] = await Promise.all([
                features[featureToUse].load(),
                configurations[featureToUse + "/" + configToLoad]()
            ]);
            
            const contextMappings = contexts[featureToUse];
            const load = ${this.getLoadFunctionByTarget(target)};
            overrideConfig.push(COM.use({config: { contextMappings }}))

            const serverConfig = await load('server-config.js');
            overrideConfig.push(...serverConfig);

            

            /* Run the engine */
            run([${currentFeatureSymbol}.default], [...${currentConfigSymbol}.default, ...overrideConfig]);
        };

        export default runEngine${target === 'node' ? ';' : `(options);`}

        `;

        return entryCode;
    }

    public buildStaticEntities({
        name,
        target,
        featureMapping,
        envFiles,
        currentConfigName,
        currentFeatureName,
        publicPath = '/',
        contextFiles = new Set()
    }: EngineEnvironmentDef) {
        const currentConfigSymbol = 'currentConfig';
        const currentFeatureSymbol = 'currentFeature';
        const imports: string[] = [];

        contextFiles.forEach(filePath => imports.push(esmImport({ from: filePath })));
        envFiles.forEach(filePath => imports.push(esmImport({ from: filePath })));

        imports.push(esmImport({ from: CORE_PACKAGE, names: ['run', 'COM'] }));

        const entryCode = `

        /* Environment: "${name}" | Target: "${target}" */
        ${imports.join('\n')}

        async function runEngine(overrideConfig = []){
            const ${currentFeatureSymbol} = await import(/* webpackChunkName: "${currentFeatureName}" */ ${JSON.stringify(
            featureMapping.mapping[currentFeatureName].featureFilePath
        )})

            const ${currentConfigSymbol} = await import(/* webpackChunkName: "${currentFeatureName}__${currentConfigName}" */ ${JSON.stringify(
            featureMapping.mapping[currentFeatureName].configurations[currentConfigName]
        )})

            const load = ${this.getLoadFunctionByTarget(target)};
            const serverConfig = await load('${publicPath}server-config.js');
            overrideConfig.push(...serverConfig);
 

            /* Run the engine */
            run([${currentFeatureSymbol}.default], [...${currentConfigSymbol}.default, ...overrideConfig]);
        }

        export default runEngine;
        const publicConfig = [
            COM.use({config: {topology: {publicPath: ${JSON.stringify(publicPath)}}}})
        ];
        ${target !== 'node' ? 'runEngine(publicConfig)' : ''}
        `;

        return deindent(entryCode);
    }

    private createFeaturesObject(featureMapping: FeatureMapping) {
        const props: Array<{ key: string; value: string }> = [];
        for (const [featureName, singleFeature] of Object.entries(featureMapping.mapping)) {
            props.push({
                key: featureName,
                value: `{
                    load: () => import(/* webpackChunkName: "${featureName}" */ ${JSON.stringify(
                    singleFeature.featureFilePath
                )}),
                    defaultConfig: "${Object.keys(singleFeature.configurations)[0]}"
                }`
            });
        }
        return declareObject('features', props);
    }

    private createConfigObject(featureMapping: FeatureMapping) {
        const props: Array<{ key: string; value: string }> = [];
        for (const [featureName, singleFeature] of Object.entries(featureMapping.mapping)) {
            for (const [configName, configPath] of Object.entries(singleFeature.configurations)) {
                props.push({
                    key: featureName + '/' + configName,
                    value: `() => import(/* webpackChunkName: "${featureName + '__' + configName}" */ ${JSON.stringify(
                        configPath
                    )})`
                });
            }
            props.push({
                key: featureName + '/undefined',
                value: 'loadEmpty'
            });
        }

        return declareObject('configurations', props);
    }

    private createContextsObject(featureMapping: FeatureMapping) {
        const contextObject: Record<string, Record<string, string>> = {};
        for (const [featureName, singleFeature] of Object.entries(featureMapping.mapping)) {
            for (const [envName, contextName] of Object.entries(singleFeature.context)) {
                if (!contextObject[featureName]) {
                    contextObject[featureName] = {};
                }
                contextObject[featureName][envName] = contextName;
            }
        }

        return JSON.stringify(contextObject);
    }

    private getLoadFunctionByTarget(target: JSRuntime) {
        switch (target) {
            case 'node':
                return this.getNodeLoadFunction();
            case 'web':
                return this.getWebLoadFunction();
            case 'webworker':
                return this.getWebWorkerLoadFunction();
        }
    }

    private getNodeLoadFunction() {
        return `url => []`;
    }

    private getWebLoadFunction() {
        return `async url => {	
            return await (await fetch(url)).json();	
        }`;
    }

    private getWebWorkerLoadFunction() {
        return `url => {
            return new Promise(async (resolve, reject) => {
                function responseListener () {
                    resolve(JSON.parse(this.responseText));
                }

                function errorListener(e) {
                    reject(new Error("Wasn\'t able to get topology from the host at " + url))
                }
    
                const request = new XMLHttpRequest();
                request.addEventListener("load", responseListener);
                request.addEventListener("error", errorListener);
                request.open('GET', url);
                request.send()

            });
            
        }`;
    }
}

type ObjectPropsList = Array<{ key: string; value: string }>;

/**
 *
 * @param symbolName const symbol of the generated object
 * @param props array of {key, value} pairs
 * @param comment comment string to add at the beginning
 */
function declareObject(symbolName: string, props: ObjectPropsList, comment: string = '') {
    const commentString = comment ? `\n/*\n${comment}\n*/\n` : '';
    const propsString = props.map(({ key, value }) => `"${key}" : ${value}`);
    return `${commentString}const ${symbolName} = {${propsString.join(', ')}};`;
}

/**
 * Generate esm import string
 *
 * @param from module id or path to a module
 * @param names named symbols to import
 * @param defaultImport symbol for default import
 */
function esmImport(importDef: ImportDef): string {
    const { from, names, defaultImport } = importDef;
    const hasNamed = names && !!names.length;
    const defaultImportString = defaultImport ? defaultImport + (hasNamed ? ', ' : '') : '';
    const namedString = hasNamed ? `{${names}}` : ``;
    const fromString = defaultImportString || namedString ? ' from ' : '';
    return `import ${defaultImportString}${namedString}${fromString}${JSON.stringify(from)};`;
}

interface ImportDef {
    from: string;
    names?: string[] | null | undefined;
    defaultImport?: string | null | undefined;
}
