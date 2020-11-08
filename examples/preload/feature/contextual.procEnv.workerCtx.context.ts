import contextualFeature, { procEnv } from './contextual.feature';
globalThis.envMessages = [...(globalThis.envMessages ?? []), 'workerEnvCtxEval'];

contextualFeature.setupContext(procEnv, 'someCtx', () => ({}));
