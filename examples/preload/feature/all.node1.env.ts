import allFeature, { nodeEnv } from './all.feature';
globalThis.envMessages.push('enveval');

allFeature.setup(nodeEnv, () => {
    return {
        nodeEnvMessages: {
            getNodeEnvMessages: () => [...globalThis.envMessages],
        },
    };
});
