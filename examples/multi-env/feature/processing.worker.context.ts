import MultiEnvFeature from './multi-env.feature';

MultiEnvFeature.setupContext('processingContext', () => {
    let testName = 'test2';

    return {
        name: () => testName,
        dispose: () => (testName = 'disposed')
    };
});
