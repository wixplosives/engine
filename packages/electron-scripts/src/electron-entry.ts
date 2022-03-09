import { createDisposables } from '@wixc3/create-disposables';
import { isRunOptionsMessage, runElectronEnv } from '@wixc3/engine-electron-host';

const runElectronEnvListener = async (message: unknown) => {
    if (isRunOptionsMessage(message)) {
        const { runOptions } = message;
        const disposables = createDisposables();
        try {
            const { dispose } = await runElectronEnv({
                ...runOptions,
                features: new Map(runOptions.features),
            });
            disposables.add(dispose);
        } catch (ex) {
            await disposables.dispose();
            process.exitCode = 1;
            // eslint-disable-next-line no-console
            console.error(ex);
        }
    }
};

// eslint-disable-next-line @typescript-eslint/no-misused-promises
process.once('message', runElectronEnvListener);
