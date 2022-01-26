import { socketClientInitializer } from '@wixc3/engine-core';
import sampleFeature, { client, server } from './x.feature';

sampleFeature.setup(client, ({ runtimeMetadata, run }, { COM: { communication } }) => {
    document.body.textContent = '';
    run(async () => {
        await socketClientInitializer({ communication, env: server });
        const runtimeMetadataConfig = await runtimeMetadata.getRuntimeMetadata();
        document.body.textContent = JSON.stringify(runtimeMetadataConfig);
    });
});
