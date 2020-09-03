import type { Application } from '@wixc3/engine-scripts/src';

export class ApplicationProxyService {
    public constructor(private app: Application) {}

    public getApp() {
        return this.app;
    }
}
