import { socketClientInitializer } from '@wixc3/engine-core';
import sampleFeature, { client, server } from './x.feature';

sampleFeature.setup(client, ({ runtimeMetadata, run }, { COM: { communication } }) => {
    run(async () => {
        await socketClientInitializer({ communication, env: server });
        const engineerMetadataConfig = await runtimeMetadata.getEngineerMetadata();
        document.body.textContent = JSON.stringify(engineerMetadataConfig);
    });
});
