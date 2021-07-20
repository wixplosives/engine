import { contextualEnv } from './some-feature.feature';
import sampleFeature from './some-feature.feature';

sampleFeature.setup(contextualEnv, ({}, {}, { echoContext: { echoWord } }) => {
    return {
        serverService: {
            echo: () => echoWord(),
        },
    };
});
