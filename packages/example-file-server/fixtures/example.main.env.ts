import { main } from '../src/file-server.feature';
import { FileData } from '../src/types';
import TestFeature from './example.feature';

/**
 * setting up the local main environment file
 */
TestFeature.setup(main, ({ run }, { fileServerExample: { remoteFiles, fileServerConfig } }) => {
    run(async () => {
        /**
         * using the remoteFiles API from the fileServer feature, to retrieve files from the local fs
         */
        const dir = await remoteFiles.readDir(fileServerConfig.defaultDirName);

        /**
         * printing all file names of a folder to the console
         */
        Object.keys(dir).forEach(async key => {
            if (dir[key].filePath) {
                const file = dir[key] as FileData;
                const k = await remoteFiles.readFile(file.filePath);
                // tslint:disable-next-line: no-console
                console.log(k);
            }
        });

        /**
         * printing the directory tree to the browser
         */
        document.body.innerHTML = `<div id='testdiv'>${JSON.stringify(dir, null, 4).replace(/\r\n/, '<br />')}</div>`;
    });

    return null;
});
