globalThis.envMessages.push('enveval');
import allFeature, { nodeEnv } from './all.feature';

allFeature.setup(nodeEnv, () => {
    return {
        nodeEnvMessages: {
            getNodeEnvMessages: () => [...globalThis.envMessages],
        },
    };
});
