import { reportError } from '@wixc3/engine-core';
import { workerThreadInitializer } from '@wixc3/engine-runtime-node';
import emptyFeature, { serverEnv, workerEnv } from './empty.feature';

emptyFeature.setup(serverEnv, ({ onDispose }, { COM: { communication } }) => {
    workerThreadInitializer({
        communication,
        env: workerEnv,
    })
        .then(({ dispose }) => {
            onDispose(dispose);
        })
        .catch(reportError);
});
