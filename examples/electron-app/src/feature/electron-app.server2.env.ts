import ElectronApp, { server2 } from './electron-app.feature.js';

/**
 * setting up the server environment
 */
ElectronApp.setup(server2, ({ echoService: { getText } }) => {
    /**
     * exposing an sample service from a server environment
     */
    const listeners = new Set<(times: number) => void>();
    return {
        anotherEchoService: {
            echo: () => Promise.resolve('from server2'),
            subscribe: (callback) => {
                listeners.add(callback);
            },
            invokeListeners() {
                for (const listener of listeners) {
                    listener(2);
                }
            },
            async getText() {
                return `${await getText()}${await this.echo()}`;
            },
        },
    };
});
