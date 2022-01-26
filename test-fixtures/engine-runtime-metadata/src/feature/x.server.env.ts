import SampleFeature, { server } from './x.feature';

SampleFeature.setup(server, ({}, { runtimeMetadata: { config: runtimeMetadataConfig } }) => {
    return {
        runtimeMetadata: { getRuntimeMetadata: () => runtimeMetadataConfig },
    };
});
