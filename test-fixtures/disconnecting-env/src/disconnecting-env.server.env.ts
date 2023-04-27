import testFeature, { serverEnv } from './disconnecting-env.feature';

testFeature.setup(serverEnv, ({ run, onDispose, errorType: { errorMode } }) => {
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
        if (errorMode === 'dispose-timeout') {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            onDispose(
                () =>
                    new Promise((r) => {
                        setTimeout(r, 20_000);
                    })
            );
        }
    });
});
