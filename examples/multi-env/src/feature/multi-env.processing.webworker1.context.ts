import MultiEnvFeature, { processingEnv } from './multi-env.feature.js';

MultiEnvFeature.setupContext(processingEnv, 'processingContext', () => {
    let testName = 'webworker env';

    return {
        name: () => testName,
        dispose: () => (testName = 'disposed'),
    };
});
