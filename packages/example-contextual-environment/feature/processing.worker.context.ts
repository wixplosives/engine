import ContextualFeature from './contextual.feature';

ContextualFeature.setupContext('processingContext', () => {
    let testName = 'test2';

    return {
        name: () => testName,
        dispose: () => (testName = 'disposed')
    };
});
