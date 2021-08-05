import type { PerformanceMetrics } from '@wixc3/engine-runtime-node';
import type { IFeatureTarget, IFeatureMessagePayload } from '@wixc3/engine-scripts';

export interface IExecutableApplication {
    getServerPort(): Promise<number>;
    runFeature(featureTarget: IFeatureTarget): Promise<IFeatureMessagePayload>;
    closeFeature(featureTarget: IFeatureTarget): Promise<void>;
    closeServer(): Promise<void>;
    getMetrics(): Promise<PerformanceMetrics>;
}
