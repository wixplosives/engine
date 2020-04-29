import ElectronAppFeature, { renderer, server } from './electron-app.feature';
import { fork } from 'child_process';
import { IPCHost } from '@wixc3/engine-core-node';

ElectronAppFeature.setup(renderer, ({ run }, { COM: { startEnvironment } }) => {
    run(async () => {
        /**
         * starting the server environment.
         * Since we are on ipc-renderer enviroenmnt, we have all native node api's
         */
        await startEnvironment(server, (com) => {
            /**
             * forking the server entry
             */
            const serverProcess = fork('../src/server-entry.ts', [], {
                cwd: __dirname,
                execArgv: ['-r', '@ts-tools/node/r'],
                stdio: 'inherit',
            });

            /**
             * creating a host for communication between IPC and window
             */
            const serverHost = new IPCHost(serverProcess);

            /**
             * registering the enviromnemt
             */
            com.registerEnv('server', serverHost);

            /**
             * listening to messages coming from serverHost
             */
            com.registerMessageHandler(serverHost);

            return Promise.resolve({
                id: server.env,
            });
        });
    });
});
