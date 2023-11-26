import type { PerformanceMetrics } from '@wixc3/engine-runtime-node';
import type { IFeatureTarget, IFeatureMessagePayload } from '@wixc3/engine-scripts';

type RunningTestFeature = {
    dispose(): void | Promise<void>;
    url?: string;
    getMetrics: () => Promise<PerformanceMetrics>;
};

export interface IExecutableApplication {
    getServerPort(featureTarget?: IFeatureTarget): Promise<number>;
    runFeature(featureTarget: IFeatureTarget): Promise<IFeatureMessagePayload & RunningTestFeature>;
    closeServer(): Promise<void>;
    init?(): Promise<void>;
}
