import ElectronApp, { server } from './electron-app.feature';

/**
 * setting up the server environment
 */
ElectronApp.setup(server, () => {
    /**
     * exposing an sample service from a server environment
     */

    const listeners = new Set<(cb: any) => void>();
    return {
        echoService: {
            echo: () => 'from server',
            subscribe: (cb) => {
                listeners.add(cb);
            },
            invokeListeners() {
                for (const listener of listeners) {
                    listener(1);
                }
            },
        },
    };
});
