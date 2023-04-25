import { NodeEnvironmentStartupOptions } from '@wixc3/engine-runtime-node';

export interface IWindowLaunchOptions {
    devtools?: boolean;
    devport?: number;
}

export const isNodeEnvStartupMessage = (value: unknown): value is INodeEnvStartupMessage => {
    return (value as INodeEnvStartupMessage).id === 'nodeStartupOptions';
};

export const isNodeEnvDisposeMessage = (value: unknown): value is INodeEnvDisposeMessage => {
    return (value as INodeEnvDisposeMessage).id === 'nodeDispose';
};

export type INodeEnvDisposeMessage = {
    id: 'nodeDispose';
};

export type INodeEnvStartupMessage = {
    id: 'nodeStartupOptions';
    runOptions: NodeEnvironmentStartupOptions;
};

export interface IExtenalFeatureDescriptor {
    envEntries: Record<string, Record<string, string>>;
    packageBasePath: string;
}
