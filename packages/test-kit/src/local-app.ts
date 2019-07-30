import { Application, IFeatureTarget } from '@wixc3/engine-scripts/src';
import { IExecutableApplication } from './types';

export class LocalApp implements IExecutableApplication {
    private application: Application;
    private disposeServer: (() => Promise<void>) | undefined;
    private disposeFeature: (() => Promise<void>) | undefined;
    private runFeatureHandler: ((target: IFeatureTarget) => Promise<{ close: () => Promise<void> }>) | undefined;

    constructor(basePath: string = process.cwd()) {
        process.chdir(basePath);
        this.application = new Application(basePath);
    }

    public async startServer() {
        const { port, runFeature, close } = await this.application.start();
        this.disposeServer = close;
        this.runFeatureHandler = runFeature;
        return port;
    }

    public async runFeature(featureTarget: IFeatureTarget) {
        if (!this.runFeatureHandler) {
            throw new Error(`server wasn't initialized`);
        }
        const { close } = await this.runFeatureHandler(featureTarget);
        this.disposeFeature = close;
    }

    public async closeFeature() {
        if (this.disposeFeature) {
            return this.disposeFeature();
        }
    }

    public async closeServer() {
        if (this.disposeServer) {
            return this.disposeServer();
        }
    }
}
