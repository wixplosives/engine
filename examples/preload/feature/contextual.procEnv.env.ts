if (!globalThis.envMessages) {
    globalThis.envMessages = [];
}
globalThis.envMessages.push('procEnvEval');

import contextualFeature, { procEnv } from './contextual.feature';

contextualFeature.setup(procEnv, () => {
    return {
        procEnvMessages: {
            getProcEnvMessages: () => [...globalThis.envMessages],
        },
    };
});
