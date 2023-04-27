import { spawn, SpawnOptions } from 'child_process';
import { deferred, timeout } from 'promise-assist';
import treeKill from 'tree-kill';
import { promisify } from 'util';
const promisifiedTreeKill = promisify(treeKill);

import type { EnvironmentInitializer, InitializerOptions } from '@wixc3/engine-core';
import { IEngineRuntimeArguments, IPCHost } from '@wixc3/engine-core-node';
import { emitEvent, executeRemoteCall, NodeEnvironmentStartupOptions, onEvent } from '@wixc3/engine-runtime-node';

import { ExpirableList } from '../expirable-list';
import {
    NodeEnvironmentCommand,
    NodeEnvironmentDisposeCommand,
    NodeEnvironmentDisposedEvent,
    NodeEnvironmentEvent,
} from '../types';

export interface InitializeNodeEnvironmentOptions extends InitializerOptions {
    runtimeArguments: IEngineRuntimeArguments;
    environmentStartupOptions?: Partial<NodeEnvironmentStartupOptions>;
    processOptions?: Pick<SpawnOptions, 'cwd' | 'shell' | 'env' | 'stdio' | 'windowsHide'>;
}

export interface ProcessExitDetails {
    /**
     * The exit code if the child exited on its own
     */
    exitCode: number | null;

    /**
     * The signal by which the child process was terminated
     */
    signal: NodeJS.Signals | null;

    /**
     * The last output process sent to stderr stream
     */
    errorMessage: string;
}

/**
 * Spawn a node-based environment from the renderer process.
 * Should be invoked *only* from the renderer process.
 * The caller should await returned `environmentIsReady` promise to ensure environment initialization is finished.
 */

export const initializeNodeEnvironment: EnvironmentInitializer<
    {
        id: string;
        dispose: () => Promise<void>;
        onExit: (cb: (details: ProcessExitDetails) => void) => void;
        environmentIsReady: Promise<void>;
    },
    InitializeNodeEnvironmentOptions
> = ({ communication, env, runtimeArguments, processOptions, environmentStartupOptions }) => {
    const envReady = communication.envReady(env.env);

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

    const envInitFailed = deferred();
    onEvent<NodeEnvironmentEvent>(child, (e) => {
        if (e.id === 'nodeEnvironmentInitFailedEvent') {
            envInitFailed.reject(e.error);
        }
    });

    emitEvent<NodeEnvironmentCommand>(child, {
        id: 'nodeEnvironmentStartupCommand',
        runOptions: nodeEnvStartupArguments,
    });

    const host = new IPCHost(child);
    communication.registerEnv(env.env, host);
    communication.registerMessageHandler(host);

    // Pipe stdout and stderr to console in the renderer process.
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', console.log); // eslint-disable-line no-console

    const errorChunks = new ExpirableList<string>(5_000);

    child.stderr?.on('data', (chunk) => {
        console.error(chunk); // eslint-disable-line no-console
        errorChunks.push(chunk);
    });

    return {
        id: env.env,
        dispose: async () => {
            const envDisposed = executeRemoteCall<NodeEnvironmentDisposeCommand, NodeEnvironmentDisposedEvent>(
                child,
                { id: 'nodeEnvironmentDisposeCommand' },
                'nodeEnvironmentDisposedEvent'
            );

            // wait for dispose finished or timeout
            await Promise.allSettled([timeout(envDisposed, 1_000)]);

            if (!child.killed) {
                child.pid ? await promisifiedTreeKill(child.pid) : child.kill();
            }
        },
        onExit: (cb: (details: ProcessExitDetails) => void) => {
            child.once('exit', (exitCode, signal) => {
                cb({ exitCode, signal, errorMessage: errorChunks.getItems().join('') });
            });
        },
        environmentIsReady: Promise.race([envReady, envInitFailed.promise]),
    };
};
