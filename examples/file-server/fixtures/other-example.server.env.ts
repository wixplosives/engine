import { server } from '../feature/file-server.feature';
import TestFeature from './other-example.feature';

/**
 * setting up the local server environment file
 */
TestFeature.setup(server, ({ run }) => {
    run(() => {
        return new Promise((res) => setTimeout(res, 2_000));
    });
});
