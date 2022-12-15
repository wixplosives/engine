import MultiEnvFeature, { IEchoService, processingEnv } from './multi-env.feature';

MultiEnvFeature.setup(processingEnv, ({ onDispose }, {}, { processingContext: { name, dispose } }) => {
    const echoService: IEchoService = {
        echo: (s: string) => {
            return `${name()} says ${s}`;
        },
    };

    onDispose(() => dispose?.());

    return { echoService };
});
