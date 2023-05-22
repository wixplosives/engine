import { NodeEnvironmentStartupOptions } from '@wixc3/engine-runtime-node';

export interface IWindowLaunchOptions {
    devtools?: boolean;
    devport?: number;
}

/**
 * The command that is sent to node env to start environment initialization process.
 */
export type NodeEnvironmentStartupCommand = {
    id: 'nodeEnvironmentStartupCommand';
    runOptions: NodeEnvironmentStartupOptions;
};

/**
 * The command that is sent to node env to start environment disposal process.
 */
export type NodeEnvironmentDisposeCommand = {
    id: 'nodeEnvironmentDisposeCommand';
};

/**
 * The command that is sent to node env.
 */
export type NodeEnvironmentCommand = NodeEnvironmentStartupCommand | NodeEnvironmentDisposeCommand;

/**
 * The event that is emitted from node env when dispose is finished.
 */
export type NodeEnvironmentDisposedEvent = {
    id: 'nodeEnvironmentDisposedEvent';
};

/**
 * The event that is emitted from node env.
 */
export type NodeEnvironmentEvent = NodeEnvironmentDisposedEvent;
