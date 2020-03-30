import ElectronApp, { server } from './electron-app.feature';

/**
 * setting up the server environment
 */
ElectronApp.setup(server, () => {
    /**
     * exposing the remoteFiles implementation of thje server side
     */
    setTimeout(() => {
        for (const listener of listeners) {
            listener(1);
        }
    }, 1_000);

    const listeners = new Set<(cb: any) => void>();
    return {
        echoService: {
            echo: () => 'from server',
            listenToTimer: cb => {
                listeners.add(cb);
            }
        }
    };
});
