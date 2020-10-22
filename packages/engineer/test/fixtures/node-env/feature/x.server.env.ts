import { serverEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(serverEnv, ({ config }) => {
    return {
        echoService: {
            echo: () => config.value,
        },
    };
});
