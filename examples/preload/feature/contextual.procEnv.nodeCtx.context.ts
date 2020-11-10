import contextualFeature, { procEnv } from './contextual.feature';
globalThis.envMessages = [...(globalThis.envMessages ?? []), 'nodeEnvCtxEval'];

contextualFeature.setupContext(procEnv, 'someCtx', () => ({}));
