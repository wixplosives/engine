import { IPCHost } from '@wixc3/engine-core-node';

import type { StartEnvironmentOptions } from './types';
import { runNodeEnvironment } from './node-environment';

export async function runIPCEnvironment(options: StartEnvironmentOptions) {
    const disposeHandlers = new Set<() => unknown>();
    const host = new IPCHost(process);
    disposeHandlers.add(() => host.dispose());
    const { dispose } = await runNodeEnvironment({
        ...options,
        host,
    });
    disposeHandlers.add(() => dispose());
    return {
        close: async () => {
            for (const disposeHandler of disposeHandlers) {
                await disposeHandler();
            }
        },
    };
}
