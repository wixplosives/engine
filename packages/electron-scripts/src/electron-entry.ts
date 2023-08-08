import { isRunOptionsMessage, runElectronEnv } from '@wixc3/engine-electron-host';
import { createDisposables } from '@wixc3/patterns';

const runElectronEnvListener = async (message: unknown) => {
    if (isRunOptionsMessage(message)) {
        const { runOptions } = message;
        const disposables = createDisposables();
        try {
            const engine = await runElectronEnv({
                ...runOptions,
                features: new Map(runOptions.features),
            });
            disposables.add(engine.shutdown, {
                name: `runElectronEnvListener engine shutdown ${engine.entityID}`,
                timeout: 10_000,
            });
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
