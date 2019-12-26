import MultiEnvFeature, { mainEnv, processingEnv } from './multi-env.feature';

MultiEnvFeature.setup(mainEnv, ({ echoService, run, config }, { COM: { spawnOrConnect } }) => {
    run(async () => {
        await spawnOrConnect(processingEnv);
        const message = await echoService.echo('roman');
        document.body.innerHTML = JSON.stringify({
            message,
            config
        });
    });

    return null;
});
