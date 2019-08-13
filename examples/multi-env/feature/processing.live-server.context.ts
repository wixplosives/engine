import MultiEnvFeature from './multi-env.feature';

MultiEnvFeature.setupContext('processingContext', () => {
    let testName = 'test';

    return {
        name: () => testName,
        dispose: () => (testName = 'disposed')
    };
});
