import { initializeNodeEnvironmentInBrowser } from '@wixc3/engine-electron';
import ElectronAppFeature, { renderer, server } from './electron-app.feature.js';

ElectronAppFeature.setup(renderer, ({ run }, { COM: { communication } }) => {
    /**
     * In cases where we start node environments from the "run", somethimes a race may appear when the environment is not ready yet, but the host is already registered. This causes commuinication not to work between the server and the renderer
     */
    const envReady = communication.envReady(server.env);

    run(async () => {
        await initializeNodeEnvironmentInBrowser({ communication, env: server });
        return envReady;
    });
});
