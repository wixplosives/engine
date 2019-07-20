import FileServer from '../src/file-server.feature';

/**
 * setting default configuration to the file server service
 */
export default [
    FileServer.use({
        fileServerConfig: {
            defaultDirName: process.cwd()
        }
    })
];
