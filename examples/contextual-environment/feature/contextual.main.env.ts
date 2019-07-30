import ContextualFeature, { mainEnv, processingEnv } from './contextual.feature';

ContextualFeature.setup(mainEnv, ({ echoService, run }, { COM: { spawnOrConnect } }) => {
    run(async () => {
        await spawnOrConnect(processingEnv);
        const echoFromProcessing = await echoService.echo('roman');
        alert(echoFromProcessing);
    });

    return null;
});
