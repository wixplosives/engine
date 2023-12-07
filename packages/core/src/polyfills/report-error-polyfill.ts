import { reportError } from "../com";

/**
 * hope this is single polyfill we need for now
 * in case if more will be added, we need to create some
 * better mechanism to handle polyfills
 */
if (globalThis.reportError === undefined) {
    globalThis.reportError = reportError;
}
