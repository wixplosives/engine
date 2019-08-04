import ContextualFeature from './contextual-with-worker-default.feature';

ContextualFeature.setupContext('echoContext', () => {
    return {
        echoWord: () => 'from worker'
    };
});
