import MultiEnvFeature, { processingEnv } from './multi-env.feature.js';

MultiEnvFeature.setupContext(processingEnv, 'processingContext', () => {
    let testName = 'node env';

    return {
        name: () => testName,
        dispose: () => (testName = 'disposed'),
    };
});
