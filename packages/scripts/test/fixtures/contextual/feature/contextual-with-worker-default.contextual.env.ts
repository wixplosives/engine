import { contextualEnv } from './contextual-with-worker-default.feature';
import sampleFeature from './contextual-with-worker-default.feature';

sampleFeature.setup(contextualEnv, ({}, {}, { echoContext: { echoWord } }) => {
    return {
        serverService: {
            echo: () => echoWord()
        }
    };
});
