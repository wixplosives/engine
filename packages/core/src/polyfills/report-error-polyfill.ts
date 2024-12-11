import { reportError } from '../com/index.js';

/**
 * This polyfill is not essential for the engine itself. But applications built
 * on the engine may require this polyfill to correctly report initialization
 * errors in older browsers.
 * Ideally, the engine should offer a mechanism allowing applications to
 * initialize necessary polyfills before the evaluation of feature files begins.
 * But so far we only need this single polyfill.
 */
if (globalThis.reportError === undefined) {
    globalThis.reportError = reportError;
}
