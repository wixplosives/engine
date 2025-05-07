import type { AnyEnvironment, EnvironmentTypes, MultiEnvironment, TopLevelConfig } from '@wixc3/engine-core';

export type TopLevelConfigProvider = (envName: string) => TopLevelConfig;

export interface IStaticFeatureDefinition {
    contextFilePaths: Record<string, string>;
    envFilePaths: Record<string, string>;
    preloadFilePaths: Record<string, string>;
    dependencies: string[];
    /**
     * the feature's name scoped to the package.json package name.
     * @example
     * ```
     * packageName = '@some-scope/my-package'
     * featureName = 'my-feature'
     * scopedName === 'my-package/my-feature'
     * ```
     * if package name is equal to the feature name, then the scoped name will just be the package name
     * if package name ends with - feature, we remove it from the scope
     */
    scopedName: string;
    resolvedContexts: Record<string, string>;
    packageName: string;
    filePath: string;
    exportedEnvs: IEnvironmentDescriptor<AnyEnvironment>[];
}

export type PerformanceMetrics = {
    marks: PerformanceEntry[];
    measures: PerformanceEntry[];
};

export interface IConfigDefinition {
    name: string;
    envName?: string;
    filePath: string;
}

export interface IEnvironmentDescriptor<ENV extends AnyEnvironment = AnyEnvironment> {
    type: EnvironmentTypes;
    name: string;
    childEnvName?: string;
    flatDependencies?: IEnvironmentDescriptor<MultiEnvironment<ENV['envType']>>[];
    env: ENV;
}
