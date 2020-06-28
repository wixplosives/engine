import type { Json } from './types';

export class ManagedIframe {
    constructor(private host?: Window | null) {}
    public getHashParams() {
        const contentWindow = this.getContentWindow();
        return contentWindow.location.hash.length
            ? this.decode(decodeURIComponent(contentWindow.location.hash.slice(1)))
            : undefined;
    }

    public decode = (hash: string) => JSON.parse(hash);
    public encode = (hashParams: Json) => JSON.stringify(hashParams);

    public createHashParams = (hashParams: Json) => `#${this.encode(hashParams)}`;

    public onHashChange(onHashChange: (ev: HashChangeEvent) => unknown) {
        this.getContentWindow().addEventListener('hashchange', onHashChange);
    }

    private getContentWindow() {
        if (!this.host) {
            throw new Error('Target is not connected to the DOM');
        }
        return this.host;
    }

    public offHashChange(onHashChange: (ev: HashChangeEvent) => unknown) {
        this.getContentWindow().removeEventListener('hashchange', onHashChange);
    }

    public updateHashParams(hashParams: Json) {
        this.getContentWindow().location.hash = this.createHashParams(hashParams);
    }
}
