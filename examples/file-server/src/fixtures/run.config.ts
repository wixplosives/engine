import FileServer from '../feature/file-server.feature.js';

/**
 * setting default configuration to the file server service
 */
export default [
    FileServer.configure({
        config: {
            title: 'test',
        },
    }),
];
