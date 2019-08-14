import MultiEnvFeature from './multi-env.feature';

MultiEnvFeature.setupContext('processingContext', () => {
    let testName = 'node env';

    return {
        name: () => testName,
        dispose: () => (testName = 'disposed')
    };
});
