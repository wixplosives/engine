import MultiEnvFeature from './some-feature.feature';

MultiEnvFeature.setupContext('echoContext', () => {
    return {
        echoWord: () => 'from worker'
    };
});
