import { IFeatureTarget } from '@wixc3/engine-scripts';

export interface IExecutableApplication {
    getServerPort(): Promise<number>;
    runFeature(featureTarget: IFeatureTarget): Promise<string>;
    closeFeature(featureTarget: IFeatureTarget): Promise<void>;
    closeServer(): Promise<void>;
}
