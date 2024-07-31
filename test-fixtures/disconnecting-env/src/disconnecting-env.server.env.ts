import testFeature, { serverEnv } from './disconnecting-env.feature.js';

testFeature.setup(serverEnv, ({ run, errorsConfig: { throwError, handleUncaught } }) => {
    if (handleUncaught) {
        process.on('uncaughtException', () => {
            process.exit(1);
        });
    }

    run(() => {
        if (throwError === 'exception') {
            throw new Error('Throwing a regular exception');
        }
        if (throwError === 'exit') {
            process.exit(1);
        }
        if (throwError === 'promise-reject') {
            void Promise.reject(new Error('promise reject'));
        }
    });
});
