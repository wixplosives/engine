import testFeature, { serverEnv } from './disconnecting-env.feature';

testFeature.setup(serverEnv, ({ run, errorType: { errorMode } }) => {
    run(() => {
        if (errorMode === 'exception') {
            throw new Error('Throwing a regular exception');
        }
        if (errorMode === 'exit') {
            process.exit(1);
        }
        if (errorMode === 'promiseReject') {
            void Promise.reject('promise reject');
        }
    });
});
