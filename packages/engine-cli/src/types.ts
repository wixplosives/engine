import type { Plugin } from 'esbuild';
import type { AnyEnvironment, FeatureClass, TopLevelConfig } from '@wixc3/engine-core';
import type {
    IEnvironmentDescriptor,
    IStaticFeatureDefinition,
    PerformanceMetrics,
    TopLevelConfigProvider,
} from '@wixc3/engine-runtime-node';
import type { BuildOptions } from 'esbuild';
import type io from 'socket.io';

export interface IFeatureTarget {
    featureName?: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
}

export interface IFeatureMessagePayload {
    featureName: string;
    configName: string;
}

export type RunningFeature = IFeatureMessagePayload & {
    dispose(): void | Promise<void>;
    url?: string;
    getMetrics: () => Promise<PerformanceMetrics>;
};

export interface IExecutableApplication {
    getServerPort(featureTarget?: IFeatureTarget): Promise<number>;
    runFeature(featureTarget: IFeatureTarget): Promise<RunningFeature>;
    closeServer(): Promise<void>;
    init?(): Promise<void>;
}

export interface EngineConfig {
    require?: string[];
    import?: string[];
    featureDiscoveryRoot?: string;
    /** relative path to the location of engine features (packages) */
    featuresDirectory?: string;
    /** relative path to the location of templates for generating engine features (packages) */
    featureTemplatesFolder?: string;
    serveStatic?: StaticConfig[];
    socketServerOptions?: Partial<io.ServerOptions>;
    sourcesRoot?: string;
    favicon?: string;
    buildPlugins?: Plugin[] | OverrideConfigHook;
    customEntrypoints?: string;

    /**
     * extra resolver conditions to add while building project.
     * used for finding features and running in dev time
     */
    buildConditions?: string[];

    /** @default [".js", ".json"] */
    extensions?: string[];
    engineRuntimeArgsFlags?: Record<string, CliFlag<string | boolean>>;
}

export interface StaticConfig {
    route: string;
    directoryPath: string;
}

export type BuildConfiguration = {
    webConfig: BuildOptions;
    nodeConfig: BuildOptions;
    dev?: boolean;
};

export type OverrideConfigHook = (config: BuildConfiguration) => BuildConfiguration;

export type CliFlag<T> = {
    /** e.g. String, Boolean, etc. */
    type: (value: string) => T;
    /** description to be used in help output */
    description: string;
    /** default value */
    defaultValue: T;
};

export interface IFeatureDefinition extends IStaticFeatureDefinition, IFeatureModule {
    isRoot: boolean;
    directoryPath: string;
    toJSON(): IStaticFeatureDefinition;
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
    exportedFeature: FeatureClass;

    /**
     * Exported environments from module.
     */
    exportedEnvs: IEnvironmentDescriptor<AnyEnvironment>[];

    /**
     * If module exports any `processingEnv.useContext('webworker')`,
     * it will be set as `'processing': 'webworker'`
     */
    usedContexts?: Record<string, string>;
}
