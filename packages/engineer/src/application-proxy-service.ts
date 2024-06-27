import { nodeFs } from '@file-services/node';
import type { IConfigDefinition, LaunchEnvironmentMode, NodeEnvironmentsManager } from '@wixc3/engine-runtime-node';
import {
    analyzeFeatures,
    generateConfigName,
    type IFeatureDefinition,
    type IFeatureMessagePayload,
    type OverrideConfig,
} from '@wixc3/engine-scripts';
import {
    Application,
    type IApplicationOptions,
    type ICompilerOptions,
    type IRunFeatureOptions,
} from '@wixc3/engine-scripts/dist/application/index.js';
import type { SetMultiMap } from '@wixc3/patterns';

export class TargetApplication extends Application {
    public nodeEnvironmentsMode?: LaunchEnvironmentMode;
    private nodeEnvManager?: NodeEnvironmentsManager;
    private overrideConfigsMap: Map<string, OverrideConfig> = new Map<string, OverrideConfig>();

    constructor(opts: IApplicationOptions) {
        super(opts);
    }

    public getEngineConfig() {
        return super.getEngineConfig();
    }

    public getClosestEngineConfigPath(): Promise<string | undefined> {
        return super.getClosestEngineConfigPath();
    }

    public getFeatures(
        singleFeature?: boolean,
        featureName?: string,
        featureDiscoveryRoot?: string,
        extensions?: string[],
        extraConditions?: string[],
    ) {
        return analyzeFeatures(
            nodeFs,
            this.basePath,
            featureDiscoveryRoot,
            singleFeature ? featureName : undefined,
            extensions,
            extraConditions,
        );
    }

    public importModules(requiredModules: string[]) {
        return super.importModules(requiredModules);
    }

    public createCompiler(compilerArgs: ICompilerOptions) {
        return super.createCompiler(compilerArgs);
    }

    public getFeatureEnvDefinitions(
        features: Map<string, IFeatureDefinition>,
        configurations: SetMultiMap<string, IConfigDefinition>,
    ) {
        return super.getFeatureEnvDefinitions(features, configurations);
    }

    public setNodeEnvManager(nem: NodeEnvironmentsManager, nodeEnvironmentsMode?: LaunchEnvironmentMode) {
        this.nodeEnvironmentsMode = nodeEnvironmentsMode;
        this.nodeEnvManager = nem;
    }

    public getNodeEnvManager() {
        return this.nodeEnvManager;
    }

    public getOverrideConfigsMap() {
        return this.overrideConfigsMap;
    }

    public runFeature = async ({
        featureName,
        runtimeOptions = {},
        configName,
        overrideConfig,
    }: IRunFeatureOptions) => {
        if (overrideConfig) {
            const generatedConfigName = generateConfigName(configName);
            this.overrideConfigsMap.set(generatedConfigName, {
                overrideConfig: Array.isArray(overrideConfig) ? overrideConfig : [],
                configName,
            });
            configName = generatedConfigName;
        }
        // clearing because if running features one after the other on same engine, it is possible that some measuring were done on disposal of stuff, and the measures object will not be re-evaluated, so cleaning it
        performance.clearMeasures();
        performance.clearMarks();
        return this.getNodeEnvManager()!.runServerEnvironments({
            featureName,
            configName,
            overrideConfigsMap: this.overrideConfigsMap,
            runtimeOptions,
            mode: this.nodeEnvironmentsMode,
        });
    };

    public closeFeature = ({ featureName, configName }: IFeatureMessagePayload) => {
        if (configName) {
            this.overrideConfigsMap.delete(configName);
        }
        performance.clearMeasures();
        performance.clearMarks();
        return this.getNodeEnvManager()!.closeEnvironment({
            featureName,
            configName,
        });
    };
    public getMetrics = () => {
        return {
            marks: performance.getEntriesByType('mark'),
            measures: performance.getEntriesByType('measure'),
        };
    };
}
