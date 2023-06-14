import { nodeFs } from '@file-services/node';
import type { SetMultiMap } from '@wixc3/patterns';
import type { IConfigDefinition, LaunchEnvironmentMode, NodeEnvironmentsManager } from '@wixc3/engine-runtime-node';
import {
    analyzeFeatures,
    Application,
    generateConfigName,
    IApplicationOptions,
    ICompilerOptions,
    IFeatureDefinition,
    IFeatureMessagePayload,
    IRunFeatureOptions,
    OverrideConfig,
} from '@wixc3/engine-scripts';

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

    public getFeatures(singleFeature?: boolean, featureName?: string, featureDiscoveryRoot?: string) {
        return analyzeFeatures(nodeFs, this.basePath, featureDiscoveryRoot, singleFeature ? featureName : undefined);
    }

    public filterByFeatureName(features: Map<string, IFeatureDefinition>, featureName: string) {
        return super.filterByFeatureName(features, featureName);
    }

    public importModules(requiredModules: string[]) {
        return super.importModules(requiredModules);
    }

    public createCompiler(compilerArgs: ICompilerOptions) {
        return super.createCompiler(compilerArgs);
    }

    public getFeatureEnvDefinitions(
        features: Map<string, IFeatureDefinition>,
        configurations: SetMultiMap<string, IConfigDefinition>
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
