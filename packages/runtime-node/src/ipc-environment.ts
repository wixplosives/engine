import { COM } from '@wixc3/engine-core';
import { IPCHost } from '@wixc3/engine-core-node';

import type { StartEnvironmentOptions } from './types';
import { runNodeEnvironment } from './node-environment';

export interface StartIPCEnvironmntOptions extends StartEnvironmentOptions {
    parentEnvName: string;
}

export async function runIPCEnvironment(options: StartIPCEnvironmntOptions) {
    const disposeHandlers = new Set<() => unknown>();
    const host = new IPCHost(process);
    disposeHandlers.add(() => host.dispose());
    const config = [
        ...(options.config ?? []),
        COM.use({
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
