import contextualFeature, { procEnv } from './contextual.feature';
globalThis.envMessages.push('workerEnvCtxEval');

contextualFeature.setupContext(procEnv, 'someCtx', () => ({}));
