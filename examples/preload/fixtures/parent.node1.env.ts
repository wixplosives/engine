import { nodeEnv } from '../feature/all.feature';
import parentFeature from './parent.feature';
globalThis.envMessages.push('parentEnvEval');

// eslint-disable-next-line @typescript-eslint/no-empty-function
parentFeature.setup(nodeEnv, () => {});
