import { createDisposables } from '@wixc3/create-disposables';
import { isRunOptionsMessage, runElectronEnv } from '@wixc3/engine-electron-host';

const runElectronEnvListener: NodeJS.MessageListener = async (message) => {
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
process.once('message', runElectronEnvListener);
