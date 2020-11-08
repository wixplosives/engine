import contextualFeature, { procEnv } from './contextual.feature';
globalThis.envMessages.push('nodeEnvCtxEval');

contextualFeature.setupContext(procEnv, 'someCtx', () => ({}));
