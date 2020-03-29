import ElectronApp, { server } from './electron-app.feature';

/**
 * setting up the server environment
 */
ElectronApp.setup(server, () => {
    /**
     * exposing the remoteFiles implementation of thje server side
     */
    let timer = 0;
    setInterval(() => ++timer, 500);
    return {
        echoService: {
            echo: () => 'from server',
            listenToTimer: cb => {
                cb(timer);
            }
        }
    };
});
