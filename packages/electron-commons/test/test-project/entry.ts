import { COM, RuntimeEngine } from '@wixc3/engine-core';
import { IPCHost } from '@wixc3/engine-core-node';
import { isNodeEnvStartupMessage } from '@wixc3/engine-electron-commons';
import feature, { serverEnv } from './test-feature.feature';
import './test-feature.server.env';

process.once('message', (message) => {
    if (isNodeEnvStartupMessage(message)) {
        void new RuntimeEngine(serverEnv, [
            COM.use({ config: { resolvedContexts: {} } }),
            ...message.runOptions.config,
            COM.use({ config: { host: new IPCHost(process), id: 'server' } }),
        ]).run([COM, feature]);

        if (
            (message.runOptions.config[0]![1] as { errorType: { handleUncaught?: boolean } }).errorType.handleUncaught
        ) {
            process.on('uncaughtException', () => {
                // User can do any other cleanup here
                process.exit(1);
            });
        }
    }
});
