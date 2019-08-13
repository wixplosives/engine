import MultiEnvFeature, { mainEnv, processingEnv } from './multi-env.feature';

MultiEnvFeature.setup(mainEnv, ({ echoService, run }, { COM: { spawnOrConnect } }) => {
    run(async () => {
        await spawnOrConnect(processingEnv);
        const echoFromProcessing = await echoService.echo('roman');
        alert(echoFromProcessing);
    });

    return null;
});
