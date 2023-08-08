import { initializeNodeEnvironmentInNode } from '@wixc3/engine-electron-node';
import ElectronApp, { server, server2 } from './electron-app.feature.js';

/**
 * setting up the server environment
 */
ElectronApp.setup(server, ({ anotherEchoService: { getText } }, { COM: { communication } }) => {
    /**
     * exposing an sample service from a server environment
     */
    void initializeNodeEnvironmentInNode({ communication, env: server2 });
    const listeners = new Set<(times: number) => void>();
    return {
        echoService: {
            echo: async () => getText(),
            subscribe: (callback) => {
                listeners.add(callback);
            },
            invokeListeners() {
                for (const listener of listeners) {
                    listener(1);
                }
            },
            getText() {
                return Promise.resolve('server text');
            },
        },
    };
});
