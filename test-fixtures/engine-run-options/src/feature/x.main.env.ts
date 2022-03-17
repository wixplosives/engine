import sampleFeature, { MAIN, PROC } from './x.feature';
import { socketClientInitializer } from '@wixc3/engine-com';

sampleFeature.setup(MAIN, ({ run, passedOptions }, { COM: { communication } }) => {
    run(async () => {
        await socketClientInitializer({ communication, env: PROC });
        document.body.textContent = JSON.stringify(await passedOptions.getOptions());
    });
});
