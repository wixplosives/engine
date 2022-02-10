import SampleFeature, { server } from './x.feature';

SampleFeature.setup(server, ({}, { runtimeMetadata: { engineerMetadataConfig } }) => {
    return {
        runtimeMetadata: { getRuntimeMetadata: () => engineerMetadataConfig },
    };
});
