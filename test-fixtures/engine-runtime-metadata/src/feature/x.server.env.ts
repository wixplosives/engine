import SampleFeature, { server } from './x.feature.js';

SampleFeature.setup(server, ({}, { runtimeMetadata: { engineerMetadataConfig } }) => {
    return {
        runtimeMetadata: { getEngineerMetadata: () => engineerMetadataConfig },
    };
});
