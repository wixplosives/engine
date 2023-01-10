import type { AnyEnvironment, Feature, TopLevelConfig } from '@wixc3/engine-core';
import type {
    IEnvironmentDescriptor,
    IStaticFeatureDefinition,
    LaunchEnvironmentMode,
    TopLevelConfigProvider,
} from '@wixc3/engine-runtime-node';
import type io from 'socket.io';

export interface IFeatureTarget {
    featureName?: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
}

export interface IFeatureDefinition extends Required<IStaticFeatureDefinition>, IFeatureModule {
    isRoot: boolean;
    directoryPath: string;
    toJSON(): unknown;
}

export interface IFeatureModule {
    /**
     * Feature name.
     * @example "gui" for "gui.feature.ts"
     */
    name: string;

    /**
     * Absolute path pointing to the feature file.
     */
    filePath: string;

    /**
     * Actual evaluated Feature instance exported from the file.
     */
    exportedFeature: Feature;

    /**
     * Exported environments from module.
     */
    exportedEnvs: IEnvironmentDescriptor<AnyEnvironment>[];

    /**
     * If module exports any `processingEnv.use('webworker')`,
     * it will be set as `'processing': 'webworker'`
     */
    usedContexts?: Record<string, string>;
}

export interface IFeatureMessagePayload {
    featureName: string;
    configName: string;
}

export interface IPortMessage {
    port: number;
}

export interface StaticConfig {
    route: string;
    directoryPath: string;
}

export interface EngineConfig {
    require?: string[];
    featureDiscoveryRoot?: string;
    featuresDirectory?: string;
    featureTemplatesFolder?: string;
    featureFolderNameTemplate?: string;
    serveStatic?: StaticConfig[];
    socketServerOptions?: Partial<io.ServerOptions>;
    sourcesRoot?: string;
    favicon?: string;
    nodeEnvironmentsMode?: LaunchEnvironmentMode;
}
