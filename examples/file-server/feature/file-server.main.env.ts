import FileServer, { server } from './file-server.feature';
import { socketServerInitializer } from '@wixc3/engine-core';

/**
 * Setting up the FileServer feature main environment
 */
FileServer.setup('main', ({ run, config }, { COM: { startEnvironment } }) => {
    /**
     * the main env for this feature only creates the connection to the server environment
     */

    run(async () => {
        document.title = config.title ?? 'my title';
        await startEnvironment(server, socketServerInitializer());
    });
});
