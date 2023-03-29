import testFeature, { serverEnv } from './disconnecting-env.feature';

testFeature.setup(serverEnv, ({ run, errorType: { type } }) => {
    run(() => {
        if (type === 'exception') {
            throw new Error('Throwing a regular exception');
        }
        if (type === 'exit') {
            process.exit(1);
        }
        if (type === 'promiseReject') {
            void Promise.reject('promise reject');
        }
    });
});
