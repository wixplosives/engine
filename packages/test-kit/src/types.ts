import { IFeatureTarget } from '@wixc3/engine-scripts';

export interface IExecutableApplication {
    getServerPort(): Promise<number>;
    runFeature(featureTarget: IFeatureTarget): Promise<void>;
    closeFeature(featureTarget: IFeatureTarget): Promise<void>;
    closeServer(): Promise<void>;
}
