import type { FeatureLoadersRegistry } from '@wixc3/engine-core';
import type { IExternalFeatureNodeDescriptor } from '@wixc3/engine-runtime-node';

declare global {
    interface Window {
        _engine_: Record<string, unknown>;
        runtimeFeatureLoader: FeatureLoadersRegistry | undefined;
        externalFeatures: IExternalFeatureNodeDescriptor[];
    }
}
export default global;

declare module 'electron' {
    interface IPCRenderer {
        invoke: (method: string) => Promise<unknown>;
    }
    const electron: { ipcRenderer: IPCRenderer };
    export default electron;
}
