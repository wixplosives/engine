/* eslint-disable prefer-rest-params */
import Module from 'module';

interface ContextProviderItem {
    test: (request: string) => boolean;
    context: string;
}

const requestContextProviders = new Set<ContextProviderItem>();

/**
 * Add a context provider that will decide, if a request matches it's pattern, the resolution context for that request
 */
export function remapToUserLibrary(contextProviderItem: ContextProviderItem) {
    requestContextProviders.add(contextProviderItem);
}

interface StaticModule {
    /** internal node.js module system function which we monkey-patch to allow remapping */
    _resolveFilename: (request: string, ...rest: any[]) => string;
}
const originalResolveFilename = ((Module as unknown) as StaticModule)._resolveFilename;

let isMapperRegistered = originalResolveFilename === _resolveFilenameWithMapping;

function _resolveFilenameWithMapping(this: unknown) {
    // using arguments to save cycles. this function is called for every require() or require.resolve() calls
    const [request] = (arguments as unknown) as string[];

    // bails quickly on relative requests to avoid checking map
    if (request && request[0] !== '.') {
        try {
            for (const { test, context } of requestContextProviders) {
                if (test(request)) {
                    ((Module as unknown) as StaticModule)._resolveFilename = originalResolveFilename;
                    arguments[0] = require.resolve(request, { paths: [context] });
                    break;
                }
            }
        } catch {
            /** */
        } finally {
            ((Module as unknown) as StaticModule)._resolveFilename = _resolveFilenameWithMapping;
        }
    }
    return originalResolveFilename.apply(this, arguments as any);
}

export function init() {
    if (!isMapperRegistered && ((Module as unknown) as StaticModule)._resolveFilename !== _resolveFilenameWithMapping) {
        ((Module as unknown) as StaticModule)._resolveFilename = _resolveFilenameWithMapping;
        isMapperRegistered = true;
    }
}

export function clear() {
    if (isMapperRegistered) {
        requestContextProviders.clear();
        ((Module as unknown) as StaticModule)._resolveFilename = originalResolveFilename;
        isMapperRegistered = false;
    }
}
