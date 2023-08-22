import { contextualEnv } from './some-feature.feature.js';
import sampleFeature from './some-feature.feature.js';

sampleFeature.setup(contextualEnv, ({}, {}, { echoContext: { echoWord } }) => {
    return {
        serverService: {
            echo: () => echoWord(),
        },
    };
});
