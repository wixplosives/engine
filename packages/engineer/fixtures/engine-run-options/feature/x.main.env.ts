import sampleFeature, { MAIN, PROC } from './x.feature';
import { socketServerInitializer } from '@wixc3/engine-core/src';

sampleFeature.setup(MAIN, ({ run, passedOptions }, { COM: { startEnvironment } }) => {
    run(async () => {
        await startEnvironment(PROC, socketServerInitializer());
        document.body.textContent = JSON.stringify(await passedOptions.getOptions());
    });
});
