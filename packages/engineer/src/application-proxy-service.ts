import {
    Application,
    IFeatureDefinition,
    IConfigDefinition,
    NodeEnvironmentsManager,
    IRunFeatureOptions,
    IApplicationOptions,
    LaunchEnvironmentMode,
    IFeatureMessagePayload,
    generateConfigName,
    ICompilerOptions,
    OverrideConfig,
    INpmPackage,
} from '@wixc3/engine-scripts';
import type { SetMultiMap } from '@wixc3/engine-core';
import performance from '@wixc3/cross-performance';

export interface IApplicationProxyOptions extends IApplicationOptions {
    nodeEnvironmentsMode?: LaunchEnvironmentMode;
}

export class TargetApplication extends Application {
    public nodeEnvironmentsMode?: LaunchEnvironmentMode;
    private nodeEnvManager?: NodeEnvironmentsManager;
    private overrideConfigsMap: Map<string, OverrideConfig> = new Map<string, OverrideConfig>();

    constructor(opts: IApplicationProxyOptions) {
        super(opts);
        this.nodeEnvironmentsMode = opts.nodeEnvironmentsMode;
    }

    public getEngineConfig() {
        return super.getEngineConfig();
    }

    public getClosestEngineConfigPath(): Promise<string | undefined> {
        return super.getClosestEngineConfigPath();
    }

    public getFeatures(
        singleFeature?: boolean,
        featureName?: string
    ): {
        packages: INpmPackage[];
        features: Map<string, IFeatureDefinition>;
        configurations: SetMultiMap<string, IConfigDefinition>;
    } {
        const { features, configurations, packages } = super.analyzeFeatures();
        if (singleFeature && featureName) {
            this.filterByFeatureName(features, featureName);
        }
        return { features, configurations, packages };
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

    public setNodeEnvManager(nem: NodeEnvironmentsManager) {
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
