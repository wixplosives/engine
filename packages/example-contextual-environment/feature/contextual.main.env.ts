import ContextualFeature, { mainEnv, processingEnv } from './contextual.feature';

ContextualFeature.setup(mainEnv, ({ echoService, run }, { COM: { spawnOrConnect } }) => {
    spawnOrConnect(processingEnv);

    run(async () => {
        const echoFromProcessing = await echoService.echo('roman');
        alert(echoFromProcessing);
    });

    return null;
});
