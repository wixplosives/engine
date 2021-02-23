/* eslint-disable prefer-rest-params */
import path from 'path';
import Module from 'module';

const libsToRemap = new Set<string>();
const pathsToRemap = new Set<string>();

/**
 * Libraries registered here will load from user project.
 * this API is only meant to be used from other `live-server.preload` files.
 *
 * @example "typescript"
 */
export function remapToUserLibrary(libName: string) {
    libsToRemap.add(libName);
}

/**
 * path to try to resolve the remaped user libraries from
 */
export function addPath(libName: string) {
    pathsToRemap.add(libName);
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
    if (request && request[0] !== '.' && [...libsToRemap].find((userLib) => request.includes(userLib))) {
        try {
            // for this resolution we need to use only the original resolveFilename method
            ((Module as unknown) as StaticModule)._resolveFilename = originalResolveFilename;
            arguments[0] = require.resolve(request, { paths: [...pathsToRemap] });
        } catch {
            /** */
        } finally {
            ((Module as unknown) as StaticModule)._resolveFilename = _resolveFilenameWithMapping;
        }
    }
    return originalResolveFilename.apply(this, arguments as any);
}

export function init(resolveFrom?: string) {
    const baseUrl = resolveFrom ? path.resolve(resolveFrom) : process.cwd();
    addPath(baseUrl);

    if (!isMapperRegistered && ((Module as unknown) as StaticModule)._resolveFilename !== _resolveFilenameWithMapping) {
        ((Module as unknown) as StaticModule)._resolveFilename = _resolveFilenameWithMapping;
        isMapperRegistered = true;
    }
}

export function clear() {
    if (isMapperRegistered) {
        libsToRemap.clear();
        pathsToRemap.clear();
        ((Module as unknown) as StaticModule)._resolveFilename = originalResolveFilename;
        isMapperRegistered = false;
    }
}
