import MultiEnvFeature, { processingEnv, type IEchoService } from './multi-env.feature.js';

MultiEnvFeature.setup(processingEnv, ({ onDispose }, {}, { processingContext: { name, dispose } }) => {
    const echoService: IEchoService = {
        echo: (s: string) => {
            return `${name()} says ${s}`;
        },
    };

    onDispose(() => dispose?.());

    return { echoService };
});
