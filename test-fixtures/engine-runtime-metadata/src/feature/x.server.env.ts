import SampleFeature, { server } from './x.feature';

SampleFeature.setup(server, ({}, { runtimeMetadata: { runtimeMetadataConfig } }) => {
    return {
        runtimeMetadata: { getEngineerMetadata: () => runtimeMetadataConfig },
    };
});
