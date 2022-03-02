import { spawn, SpawnOptions } from 'child_process';
import { IPCHost } from '@wixc3/engine-core-node';
import type { Communication, EnvironmentInitializer, InitializerOptions } from '@wixc3/engine-core';
import type { IEngineRuntimeArguments, INodeEnvStartupMessage, NodeEnvironmentStartupOptions } from '../types';
import treeKill from 'tree-kill';
import { promisify } from 'util';
const promisifiedTreeKill = promisify(treeKill);

export interface InitializeNodeEnvironmentOptions extends InitializerOptions {
    getApplicationMetaData: (com: Communication) => Promise<IEngineRuntimeArguments>;
    environmentStartupOptions?: Partial<NodeEnvironmentStartupOptions>;
    processOptions?: Pick<SpawnOptions, 'cwd' | 'shell' | 'env'>;
}

/**
 * Spawn a node-based environment from the renderer process.
 * Should be invoked *only* from the renderer process.
 */

export const initializeNodeEnvironment: EnvironmentInitializer<
    Promise<{ id: string; dispose: () => void; onDisconnect: (cb: () => void) => void }>,
    InitializeNodeEnvironmentOptions
> = async ({ communication, env, getApplicationMetaData, processOptions, environmentStartupOptions }) => {
    const environmentIsReady = communication.envReady(env.env);

    const runtimeArguments = await getApplicationMetaData(communication);
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
            ...processOptions,
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
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
    child.stderr?.on('data', console.error); // eslint-disable-line no-console
    await environmentIsReady;
    return {
        id: env.env,
        dispose: async () => {
            if (!child.killed) {
                child.pid ? await promisifiedTreeKill(child.pid) : child.kill();
            }
        },
        onDisconnect: (cb: () => void) => {
            child.on('exit', cb);
        },
    };
};
