import { main } from '../feature/file-server.feature.js';
import TestFeature from './example.feature.js';

/**
 * setting up the local main environment file
 */
TestFeature.setup(main, ({ run }, { fileServerExample: { remoteFiles } }) => {
    run(async () => {
        /**
         * using the remoteFiles API from the fileServer feature, to retrieve files from the local fs
         */
        const dir = await remoteFiles.readDir('/');

        /**
         * printing the directory tree to the browser
         */
        document.body.innerHTML = `<div id='testdiv'>${JSON.stringify(dir, null, 4).replace(/\r\n/, '<br />')}</div>`;
    });
});
