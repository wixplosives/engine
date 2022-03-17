import contextualFeature, { mainEnv, procEnv } from './preload-context.feature';
import { socketClientInitializer, initializeContextualEnv, workerInitializer } from '@wixc3/engine-com';

contextualFeature.setup(mainEnv, ({ run, procEnvMessages: { getProcEnvMessages } }, { COM: { communication } }) => {
    const initializer = initializeContextualEnv({
        communication,
        env: procEnv,
        envInitializers: { nodeCtx: socketClientInitializer, workerCtx: workerInitializer },
    });

    run(async () => {
        await initializer;
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
