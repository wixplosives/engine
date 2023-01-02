import MultiEnvFeature, { contextualEnv } from './some-feature.feature';

MultiEnvFeature.setupContext(contextualEnv, 'echoContext', () => {
    return {
        echoWord: () => 'from webworker',
    };
});
