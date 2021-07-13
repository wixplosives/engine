import sampleFeature, { MAIN, PROC } from './x.feature';
import { socketServerInitializer } from '@wixc3/engine-core';

sampleFeature.setup(MAIN, ({ run, passedOptions }, { COM: { communication } }) => {
    run(async () => {
        await socketServerInitializer(communication, PROC);
        document.body.textContent = JSON.stringify(await passedOptions.getOptions());
    });
});
