import {
    Application,
    IFeatureDefinition,
    IConfigDefinition,
    TopLevelConfigProvider,
    NodeEnvironmentsManager,
    IRunFeatureOptions,
    IApplicationOptions,
    LaunchEnvironmentMode,
    IFeatureMessagePayload,
} from '@wixc3/engine-scripts';
import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import { generateConfigName } from '@wixc3/engine-scripts';
import type { OverrideConfig } from '@wixc3/engine-scripts';
import performance from '@wixc3/cross-performance';

export interface IApplicationProxyOptions extends IApplicationOptions {
    nodeEnvironmentsMode?: LaunchEnvironmentMode;
}

export class ApplicationProxyService extends Application {
    public nodeEnvironmentsMode?: LaunchEnvironmentMode;
    private nodeEnvManager: NodeEnvironmentsManager | null = null;
    private overrideConfigsMap: Map<string, OverrideConfig> = new Map<string, OverrideConfig>();

    constructor(opts: IApplicationProxyOptions) {
        super(opts);
        this.nodeEnvironmentsMode = opts.nodeEnvironmentsMode;
    }

    public getEngineConfig() {
        return super.getEngineConfig();
    }

    public analyzeFeatures() {
        return super.analyzeFeatures();
    }

    public getFeatureString() {
        return [...this.analyzeFeatures().features.keys()];
    }

    public filterByFeatureName(features: Map<string, IFeatureDefinition>, featureName: string) {
        return super.filterByFeatureName(features, featureName);
    }

    public importModules(requiredModules: string[]) {
        return super.importModules(requiredModules);
    }

    public createCompiler(compilerArgs: {
        features: Map<string, IFeatureDefinition>;
        featureName?: string;
        configName?: string;
        publicPath?: string;
        mode?: 'production' | 'development';
        title?: string;
        configurations: SetMultiMap<string, IConfigDefinition>;
        staticBuild: boolean;
        publicConfigsRoute?: string;
        overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
        singleFeature?: boolean;
    }) {
        return super.createCompiler(compilerArgs);
    }

    public getFeatureEnvDefinitions(
        features: Map<string, IFeatureDefinition>,
        configurations: SetMultiMap<string, IConfigDefinition>
    ) {
        return super.getFeatureEnvDefinitions(features, configurations);
    }

    public setNodeEnvManager(nem: NodeEnvironmentsManager | null) {
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
