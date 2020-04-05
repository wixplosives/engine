import { IPCHost } from '@wixc3/engine-core-node';

import { StartEnvironmentOptions } from './types';
import { runEnvironment } from './node-environment';

export async function runIPCEnvironment(options: StartEnvironmentOptions) {
    const disposeHandlers = new Set<() => unknown>();
    const host = new IPCHost(process);
    disposeHandlers.add(() => host.dispose());
    const { close } = await runEnvironment({
        ...options,
        host,
    });
    disposeHandlers.add(() => close());
    return {
        close: async () => {
            for (const disposeHandler of disposeHandlers) {
                await disposeHandler();
            }
        },
    };
}
