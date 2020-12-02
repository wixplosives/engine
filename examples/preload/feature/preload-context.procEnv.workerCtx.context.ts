import contextualFeature, { procEnv } from './preload-context.feature';
globalThis.envMessages = [...(globalThis.envMessages ?? []), 'workerEnvCtxEval'];

contextualFeature.setupContext(procEnv, 'someCtx', () => ({}));
