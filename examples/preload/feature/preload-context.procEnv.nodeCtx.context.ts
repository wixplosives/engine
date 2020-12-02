import contextualFeature, { procEnv } from './preload-context.feature';
globalThis.envMessages = [...(globalThis.envMessages ?? []), 'nodeEnvCtxEval'];

contextualFeature.setupContext(procEnv, 'someCtx', () => ({}));
