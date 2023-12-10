import { isRunOptionsMessage, runElectronEnv } from '@wixc3/engine-electron-host';
import { createDisposables } from '@wixc3/patterns';

// eslint-disable-next-line @typescript-eslint/no-misused-promises
process.once('message', async (message) => {
    if (isRunOptionsMessage(message)) {
        const { runOptions } = message;
        const disposables = createDisposables('electron-entry');
        try {
            const engine = await runElectronEnv({
                ...runOptions,
                features: new Map(runOptions.features),
            });
            disposables.add({
                name: `runElectronEnvListener engine shutdown ${engine.entityID}`,
                timeout: 10_000,
                dispose: engine.shutdown,
            });
        } catch (ex) {
            await disposables.dispose();
            process.exitCode = 1;
            // eslint-disable-next-line no-console
            console.error(ex);
        }
    } else {
        throw new Error(`Unknown message: ${JSON.stringify(message)}`);
    }
});
