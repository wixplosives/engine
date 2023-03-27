import type { Environment } from '@wixc3/engine-core';
import type { IEngineRuntimeArguments } from '@wixc3/engine-core-node';

export interface IWindowLaunchOptions {
    devtools?: boolean;
    devport?: number;
}

export interface NodeEnvironmentStartupOptions extends IEngineRuntimeArguments {
    environmentContextName?: string;
    devtools?: boolean;
    environmentName: string;
    bundlePath?: string;
    featureDiscoveryRoot?: string;
    parentEnvName: string;
    execPath?: string;
    env: Environment;
}

export interface WorkerThreadEnvironmentStartupOptions extends IEngineRuntimeArguments {
    environmentContextName?: string;
    environmentName: string;
    featureDiscoveryRoot?: string;
    env: Environment;
}

export type INodeEnvStartupMessage = {
    id: 'nodeStartupOptions';
    runOptions: NodeEnvironmentStartupOptions;
};

export type IWorkerThreadEnvStartupMessage = {
    id: 'workerThreadStartupOptions';
    runOptions: WorkerThreadEnvironmentStartupOptions;
};

export const isNodeEnvStartupMessage = (value: unknown): value is INodeEnvStartupMessage => {
    return (value as INodeEnvStartupMessage).id === 'nodeStartupOptions';
};

export const isWorkerThreadEnvStartupMessage = (value: unknown): value is INodeEnvStartupMessage => {
    return (value as INodeEnvStartupMessage).id === 'nodeStartupOptions';
};

export interface IExtenalFeatureDescriptor {
    envEntries: Record<string, Record<string, string>>;
    packageBasePath: string;
}
