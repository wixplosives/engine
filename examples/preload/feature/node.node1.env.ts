globalThis.envMessages.push('enveval');
import nodeFeature, { nodeEnv } from './node.feature';

nodeFeature.setup(nodeEnv, () => {
    return {
        nodeEnvMessages: {
            getNodeEnvMessages: () => [...globalThis.envMessages],
        },
    };
});
