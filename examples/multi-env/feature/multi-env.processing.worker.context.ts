import MultiEnvFeature from './multi-env.feature';

MultiEnvFeature.setupContext('processingContext', () => {
    let testName = 'worker env';

    return {
        name: () => testName,
        dispose: () => (testName = 'disposed')
    };
});
