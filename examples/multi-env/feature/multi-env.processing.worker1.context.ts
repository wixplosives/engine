import MultiEnvFeature, { processingEnv } from './multi-env.feature';

MultiEnvFeature.setupContext(processingEnv, 'processingContext', () => {
    let testName = 'worker env';

    return {
        name: () => testName,
        dispose: () => (testName = 'disposed'),
    };
});
