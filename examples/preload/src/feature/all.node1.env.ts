import allFeature, { nodeEnv } from './all.feature';
globalThis.envMessages = [...(globalThis.envMessages ?? []), 'enveval'];

allFeature.setup(nodeEnv, () => {
    return {
        nodeEnvMessages: {
            getNodeEnvMessages: () => [...globalThis.envMessages],
            getNodeRuntimeOptions: () => ({ ...globalThis.runtimeOptions }),
        },
    };
});
