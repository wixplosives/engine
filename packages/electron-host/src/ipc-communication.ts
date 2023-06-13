import express from 'express';

import { Communication, BaseHost, AsyncApi } from '@wixc3/engine-core';
import { IPCHost } from '@wixc3/engine-runtime-node';

import type { ChildProcess } from 'child_process';

export const DEV_SERVER_API_ID_TOKEN = {
    id: 'dev-server-api',
};
export const electronDevParentProcessEnv = { id: 'electron-dev-parent-process' };
export const electronDevChildProcessEnv = { id: 'electron-dev-child-process' };

export interface IDevSeverProcessAPI {
    registerExternalRoute: (basePath: string, route: string) => void;
}

export function provideApiForChildProcess(electronApp: ChildProcess, router: express.Express): void {
    const host = new IPCHost(electronApp);
    const com = new Communication(new BaseHost(), electronDevParentProcessEnv.id);
    com.registerEnv(electronDevChildProcessEnv.id, host);
    com.registerMessageHandler(host);
    com.registerAPI<IDevSeverProcessAPI>(DEV_SERVER_API_ID_TOKEN, {
        registerExternalRoute: (basePath, route) => {
            router.use(route, express.static(basePath));
        },
    });
}

export function getParentProcessApi(): AsyncApi<IDevSeverProcessAPI> {
    const host = new IPCHost(process);
    const com = new Communication(new BaseHost(), electronDevChildProcessEnv.id);
    com.registerEnv(electronDevParentProcessEnv.id, host);
    com.registerMessageHandler(host);
    const api = com.apiProxy<IDevSeverProcessAPI>(electronDevParentProcessEnv, DEV_SERVER_API_ID_TOKEN);
    return api;
}
