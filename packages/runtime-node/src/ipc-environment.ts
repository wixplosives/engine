import { COM } from '@wixc3/engine-core';
import { IPCHost } from './core-node/ipc-host.js';
import { runNodeEnvironment } from './node-environment.js';
import { type StartEnvironmentOptions } from './types.js';

export interface StartIPCEnvironmntOptions extends StartEnvironmentOptions {
    parentEnvName: string;
}

export async function runIPCEnvironment(options: StartIPCEnvironmntOptions) {
    const disposeHandlers = new Set<() => unknown>();
    const host = new IPCHost(process);
    disposeHandlers.add(() => host.dispose());
    const config = [
        ...(options.config ?? []),
        COM.configure({
            config: {
                connectedEnvironments: {
                    [options.parentEnvName]: {
                        id: options.parentEnvName,
                        host,
                    },
                },
            },
        }),
    ];
    const engine = await runNodeEnvironment({
        ...options,
        host,
        config,
    });
    disposeHandlers.add(engine.shutdown);
    return {
        close: async () => {
            for (const disposeHandler of disposeHandlers) {
                await disposeHandler();
            }
        },
    };
}
