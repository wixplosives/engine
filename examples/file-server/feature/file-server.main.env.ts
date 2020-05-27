import FileServer, { server, MAIN_MARK } from './file-server.feature';
import { socketServerInitializer } from '@wixc3/engine-core';
import performance from '@wixc3/cross-performance';

/**
 * Setting up the FileServer feature main environment
 */
FileServer.setup('main', ({ run, config }, { COM: { startEnvironment } }) => {
    /**
     * the main env for this feature only creates the connection to the server environment
     */
    performance.mark(MAIN_MARK);

    run(async () => {
        document.title = config.title ?? 'my title';
        await startEnvironment(server, socketServerInitializer());
    });
});
