import FileServer from '../feature/file-server.feature';

/**
 * setting default configuration to the file server service
 */
export default [
    FileServer.use({
        config: {
            title: 'test',
        },
    }),
];
