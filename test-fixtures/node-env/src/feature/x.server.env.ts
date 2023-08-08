import { serverEnv } from './x.feature.js';
import sampleFeature from './x.feature.js';

sampleFeature.setup(serverEnv, ({ config }) => {
    return {
        echoService: {
            echo: () => config.value,
        },
    };
});
