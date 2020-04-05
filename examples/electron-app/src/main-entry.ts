require('@ts-tools/node/r');
require('tsconfig-paths/register');

import { resolve } from 'path';
import fs from '@file-services/node';
import { resolvePackages, loadFeaturesFromPackages, runNodeEnvironment } from '@wixc3/engine-scripts';
import { BaseHost } from '@wixc3/engine-core';
import { IpcRenderer, ipcRenderer } from 'electron';

const basePath = resolve('../');
const packages = resolvePackages(basePath);
const { features } = loadFeaturesFromPackages(packages, fs);

class ElectronClientHost extends BaseHost {
    constructor(private host: IpcRenderer) {
        super();
        this.host.on('message', (_, data) => {
            this.emitMessageHandlers(data);
        });
    }

    postMessage(message: any) {
        this.host.send('message', message);
    }
}

const searchParams = new URLSearchParams(window.location.search.slice(1));

const featureName = searchParams.get('feature');

export default function runEnv() {
    return runNodeEnvironment({
        featureName: featureName as string,
        features: [...features.entries()],
        name: 'main',
        type: 'electron-renderer',
        host: new ElectronClientHost(ipcRenderer),
    });
}

runEnv().catch(console.error);
