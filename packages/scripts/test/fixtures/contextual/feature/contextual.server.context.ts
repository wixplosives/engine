import MultiEnvFeature from './contextual-with-worker-default.feature';

MultiEnvFeature.setupContext('echoContext', () => {
    return {
        echoWord: () => 'from server'
    };
});
