import contextualFeature, { mainEnv, procEnv } from './contextual.feature';
import { socketServerInitializer, initializeContextualEnv, workerInitializer } from '@wixc3/engine-core';

contextualFeature.setup(mainEnv, ({ run, procEnvMessages: { getProcEnvMessages } }, { COM: { startEnvironment } }) => {
    const initializer = initializeContextualEnv(procEnv, {
        nodeCtx: socketServerInitializer(),
        workerCtx: workerInitializer(),
    });

    run(async () => {
        await startEnvironment(procEnv, initializer);
        const procMessages = await getProcEnvMessages();

        const pre = document.createElement('pre');
        pre.setAttribute('id', 'envMessages');
        pre.innerHTML = JSON.stringify(
            {
                window: globalThis.envMessages,
                proc: procMessages,
            },
            null,
            2
        );

        document.body.appendChild(pre);
    });
});
