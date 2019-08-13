import FileServer, { server } from './file-server.feature';

/**
 * Setting up the FileServer feature main environment
 */
FileServer.setup('main', ({ run }, { COM: { connect } }) => {
    /**
     * the main env for this feature only creates the connection to the server environment
     */
    run(async () => {
        await connect(server);
    });

    return null;
});
