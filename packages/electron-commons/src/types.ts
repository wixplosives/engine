import type { NodeEnvironmentStartupOptions } from '@wixc3/engine-core-node';

export interface IWindowLaunchOptions {
    devtools?: boolean;
    devport?: number;
}

export const isNodeEnvStartupMessage = (value: unknown): value is INodeEnvStartupMessage => {
    return (value as INodeEnvStartupMessage).id === 'nodeStartupOptions';
};

export type INodeEnvStartupMessage = {
    id: 'nodeStartupOptions';
    runOptions: NodeEnvironmentStartupOptions;
};

export interface IExtenalFeatureDescriptor {
    envEntries: Record<string, Record<string, string>>;
    packageBasePath: string;
}
