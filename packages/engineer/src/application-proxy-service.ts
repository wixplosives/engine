import { Application, IFeatureDefinition, IConfigDefinition, TopLevelConfigProvider } from '@wixc3/engine-scripts/src';
import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core/src';

export class ApplicationProxyService extends Application {
    public serverListening = false;

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

    public isServerRunning = () => this.serverListening;

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
}
