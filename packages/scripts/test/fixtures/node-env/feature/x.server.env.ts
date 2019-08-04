import { serverEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(serverEnv, () => {
    return {
        serverService: {
            echo: () => 'Hello'
        }
    };
});
