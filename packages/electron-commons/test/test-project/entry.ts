import { runEngineApp } from '@wixc3/engine-core';
import { COM } from '@wixc3/engine-com';
import { IPCHost } from '@wixc3/engine-core-node';
import { isNodeEnvStartupMessage } from '@wixc3/engine-electron-commons';
import feature, { serverEnv } from './test-feature.feature';
import './test-feature.server.env';

process.once('message', (message) => {
    if (isNodeEnvStartupMessage(message)) {
        runEngineApp({
            features: [COM, feature],
            config: [
                ...message.runOptions.config,
                COM.use({
                    config: { resolvedContexts: {}, host: new IPCHost(process), id: 'server' },
                }),
            ],
            env: serverEnv,
        });

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
