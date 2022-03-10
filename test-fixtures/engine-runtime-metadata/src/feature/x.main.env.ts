import { socketClientInitializer } from '@wixc3/engine-core';
import sampleFeature, { client, server } from './x.feature';

sampleFeature.setup(client, ({ runtimeMetadata, run }, { COM: { communication } }) => {
    run(async () => {
        await socketClientInitializer({ communication, env: server });
        document.body.textContent = JSON.stringify(await runtimeMetadata.getEngineerMetadata());
    });
});
