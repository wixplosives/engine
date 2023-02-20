import { spawn, SpawnOptions } from 'child_process';
import { IPCHost } from '@wixc3/engine-core-node';
import type { EnvironmentInitializer, InitializerOptions } from '@wixc3/engine-core';
import type { IEngineRuntimeArguments, INodeEnvStartupMessage, NodeEnvironmentStartupOptions } from '../types';
import treeKill from 'tree-kill';
import { promisify } from 'util';
const promisifiedTreeKill = promisify(treeKill);

export interface InitializeNodeEnvironmentOptions extends InitializerOptions {
    runtimeArguments: IEngineRuntimeArguments;
    environmentStartupOptions?: Partial<NodeEnvironmentStartupOptions>;
    processOptions?: Pick<SpawnOptions, 'cwd' | 'shell' | 'env' | 'stdio' | 'windowsHide'>;
}

export interface DisconnectHandler {
    (details: DisconnectDetails): void;
}

export interface DisconnectDetails {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    lastSeenError: string | undefined;
}

/**
 * Spawn a node-based environment from the renderer process.
 * Should be invoked *only* from the renderer process.
 * The caller should await returned `environmentIsReady` promise to ensure environment initialization is finished.
 */

export const initializeNodeEnvironment: EnvironmentInitializer<
    {
        id: string;
        dispose: () => void;
        onDisconnect: (cb: DisconnectHandler) => void;
        environmentIsReady: Promise<void>;
    },
    InitializeNodeEnvironmentOptions
> = ({ communication, env, runtimeArguments, processOptions, environmentStartupOptions }) => {
    const environmentIsReady = communication.envReady(env.env);

    const nodeEnvStartupArguments: NodeEnvironmentStartupOptions = {
        ...runtimeArguments,
        ...environmentStartupOptions,
        outputPath: runtimeArguments.basePath,
        parentEnvName: communication.getEnvironmentName(),
        environmentName: env.env,
        env,
    };

    const child = spawn(
        environmentStartupOptions?.execPath ?? process.execPath,
        ['--unhandled-rejections=strict', runtimeArguments.nodeEntryPath],
        {
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            ...processOptions,
            detached: true,
            env: {
                ...process.env,
                ...processOptions?.env,
                // Spawn as a regular Node process. Without this option environment
                // communication fails quietly for reasons unknown.
                ELECTRON_RUN_AS_NODE: 'true',
            },
        }
    );

    child.send({ id: 'nodeStartupOptions', runOptions: nodeEnvStartupArguments } as INodeEnvStartupMessage);

    const host = new IPCHost(child);
    communication.registerEnv(env.env, host);
    communication.registerMessageHandler(host);

    // Pipe stdout and stderr to console in the renderer process.
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', console.log); // eslint-disable-line no-console

    let lastSeenError: string | undefined = undefined;
    child.stderr?.on('data', (chunk) => {
        console.error(chunk); // eslint-disable-line no-console
        lastSeenError = chunk;
    });

    return {
        id: env.env,
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        dispose: async () => {
            if (!child.killed) {
                child.pid ? await promisifiedTreeKill(child.pid) : child.kill();
            }
        },
        onDisconnect: (cb: DisconnectHandler) => {
            child.on('exit', (exitCode, signal) => {
                cb({ exitCode, signal, lastSeenError });
            });
        },
        environmentIsReady,
    };
};
