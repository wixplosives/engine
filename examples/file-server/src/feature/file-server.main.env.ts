import FileServer, { server, MAIN_MARK, main } from './file-server.feature';
import { socketClientInitializer } from '@wixc3/engine-core';
import performance from '@wixc3/cross-performance';

/**
 * Setting up the FileServer feature main environment
 */
FileServer.setup(main, ({ run, config }, { COM: { communication } }) => {
    /**
     * the main env for this feature only creates the connection to the server environment
     */
    performance.mark(MAIN_MARK);

    run(async () => {
        document.title = config.title ?? 'my title';
        await socketClientInitializer({ communication, env: server });
    });
});
