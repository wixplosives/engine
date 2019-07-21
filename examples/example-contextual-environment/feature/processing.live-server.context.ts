import ContextualFeature from './contextual.feature';

ContextualFeature.setupContext('processingContext', () => {
    let testName = 'test';

    return {
        name: () => testName,
        dispose: () => (testName = 'disposed')
    };
});
