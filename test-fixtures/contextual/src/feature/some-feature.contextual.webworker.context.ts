import MultiEnvFeature, { contextualEnv } from './some-feature.feature.js';

MultiEnvFeature.setupContext(contextualEnv, 'echoContext', () => {
    return {
        echoWord: () => 'from webworker',
    };
});
