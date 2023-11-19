import type { PerformanceMetrics } from '@wixc3/engine-runtime-node';
import type { IFeatureTarget, IFeatureMessagePayload } from '@wixc3/engine-scripts';

export interface IExecutableApplication {
    getServerPort(featureTarget?: IFeatureTarget): Promise<number>;
    runFeature(
        featureTarget: IFeatureTarget,
    ): Promise<IFeatureMessagePayload & { dispose(): void | Promise<void>; url?: string }>;
    closeServer(): Promise<void>;
    getMetrics(): Promise<PerformanceMetrics>;
}
