import ContextualFeature, { IEchoService, processingEnv } from './contextual.feature';

ContextualFeature.setup(processingEnv, ({ onDispose }, {}, { processingContext: { name, dispose } }) => {
    const echoService: IEchoService = {
        echo: (s: string) => {
            return `${name()} says ${s}`;
        }
    };

    onDispose(() => {
        if (dispose) {
            dispose();
        }
    });

    return { echoService };
});
