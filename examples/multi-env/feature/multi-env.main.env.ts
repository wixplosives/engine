import MultiEnvFeature, { mainEnv, processingEnv } from './multi-env.feature';

MultiEnvFeature.setup(mainEnv, ({ echoService, run }, { COM: { spawnOrConnect } }) => {
    run(async () => {
        await spawnOrConnect(processingEnv);
        const message = await echoService.echo('roman');
        document.body.innerHTML = message;
    });

    return null;
});
