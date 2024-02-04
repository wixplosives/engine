import type { PerformanceMetrics } from '@wixc3/engine-runtime-node';
import type { IFeatureTarget, IFeatureMessagePayload } from '@wixc3/engine-scripts';

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
