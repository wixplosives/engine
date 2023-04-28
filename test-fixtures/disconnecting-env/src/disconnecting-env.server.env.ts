import testFeature, { serverEnv } from './disconnecting-env.feature';

testFeature.setup(serverEnv, ({ run, onDispose, errorsConfig: { throwError, disposeTimeout, handleUncaught } }) => {
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
            void Promise.reject('promise reject');
        }
        if (disposeTimeout) {
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
