/* eslint-disable prefer-rest-params */
import Module from 'module';

const libsToRemap = new Map<string, string>();

/**
 * Libraries registered here will load from user project.
 * this API is only meant to be used from other `live-server.preload` files.
 *
 * @example "typescript"
 */
export function remapToUserLibrary(libName: string, resolutionContext: string) {
    libsToRemap.set(libName, resolutionContext);
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
    if (request && request[0] !== '.' && libsToRemap.has(request)) {
        try {
            const resolutionContext = libsToRemap.get(request)!;
            // for this resolution we need to use only the original resolveFilename method
            ((Module as unknown) as StaticModule)._resolveFilename = originalResolveFilename;
            arguments[0] = require.resolve(request, { paths: [resolutionContext] });
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
        libsToRemap.clear();
        ((Module as unknown) as StaticModule)._resolveFilename = originalResolveFilename;
        isMapperRegistered = false;
    }
}
